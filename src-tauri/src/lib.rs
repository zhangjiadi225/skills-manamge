// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

use std::fs;

mod source_manager;
use source_manager::{save_skill_source, get_skill_source};
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct Skill {
    id: String,
    name: String,
    description: String,
    author: String,
    stars: u32,
    tags: Vec<String>,
    installed: bool,
    version: Option<String>,
    downloads: Option<u32>,
    agent: String,
    is_symlink: bool,
    source: Option<String>, // New field for original repository/source URL
}

// Map of Agent Name -> Relative Path from Home
const AGENT_PATHS: &[(&str, &str)] = &[
    ("global", ".agents/skills"),                 // Official global skills path
    ("antigravity", ".gemini/antigravity/skills"), // Adjusted based on user input
    ("claude-code", ".claude/skills"),
    ("cursor", ".cursor/skills"),
    ("windsurf", ".codeium/windsurf/skills"),
    ("trae", ".trae/skills"),
    ("trae-cn", ".trae-cn/skills"),
    ("roo", ".roo/skills"),
    ("cline", ".cline/skills"),
    ("gemini-cli", ".gemini/skills"),
    ("github-copilot", ".copilot/skills"),
    // Add other agents as needed, keeping list concise for now but extensible
];

#[tauri::command]
fn get_local_skills() -> Result<Vec<Skill>, String> {
    let home_dir = dirs::home_dir().ok_or("Could not find home directory")?;
    let mut all_skills = Vec::new();

    for (agent_name, relative_path) in AGENT_PATHS {
        let skills_dir = home_dir.join(relative_path);

        if !skills_dir.exists() {
            continue;
        }

        // We use a simplified iteration here to avoid deep nesting issues
        if let Ok(entries) = fs::read_dir(skills_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    // Check if it's a symlink
                    let is_symlink = fs::symlink_metadata(&path)
                        .map(|m| m.file_type().is_symlink())
                        .unwrap_or(false);

                    let skill_id = path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();

                    // Try to get remote origin URL if it's a git repo
                    // Try to get source from saved sources first, then fallback to .git/config
                    let source = get_skill_source(&skill_id).or_else(|| {
                        // Fallback: Try to read from .git/config
                        let git_config_path = path.join(".git").join("config");
                        if git_config_path.exists() {
                            if let Ok(config_content) = fs::read_to_string(&git_config_path) {
                                // Parse git config to find remote origin URL
                                for line in config_content.lines() {
                                    let trimmed = line.trim();
                                    if trimmed.starts_with("url = ") {
                                        return Some(trimmed.trim_start_matches("url = ").to_string());
                                    }
                                }
                            }
                        }
                        None
                    });

                    let skill_md_path = path.join("SKILL.md");

                    if skill_md_path.exists() {
                        let content = fs::read_to_string(&skill_md_path).unwrap_or_default();
                        // Simple extraction
                        let description = content
                            .lines()
                            .find(|l| l.starts_with("description:"))
                            .map(|l| l.replace("description:", "").trim().to_string())
                            .unwrap_or_else(|| "No description".to_string());

                        let name = content
                            .lines()
                            .find(|l| l.starts_with("name:"))
                            .map(|l| l.replace("name:", "").trim().to_string())
                            .unwrap_or_else(|| skill_id.clone());

                        all_skills.push(Skill {
                            id: skill_id,
                            name,
                            description,
                            author: "local".to_string(),
                            stars: 0,
                            tags: vec![agent_name.to_string()],
                            installed: true,
                            version: Some("1.0.0".to_string()),
                            downloads: None,
                            agent: agent_name.to_string(),
                            is_symlink, // Populate new field
                            source,     // New field for source URL
                        });
                    }
                }
            }
        }
    }

    Ok(all_skills)
}

#[tauri::command]
async fn install_skill(
    id: String,
    skill: Option<String>,
    global: bool,
    agents: Vec<String>,
    auto_confirm: bool,
    install_mode: String,
) -> Result<String, String> {
    use std::io::Write;
    use std::process::{Command, Stdio};

    println!(
        "[INSTALL] Starting installation: {} (skill={:?}, mode={}) with global={}, agents={:?}, auto_confirm={}",
        id, skill, install_mode, global, agents, auto_confirm
    );

    let mut args = vec!["skills".to_string(), "add".to_string(), id.clone()];

    // 添加 --skill 参数（如果指定）
    if let Some(ref skill_name) = skill {
        println!("[INSTALL] Adding --skill flag: {}", skill_name);
        args.push("--skill".to_string());
        args.push(skill_name.clone());
    }
    if global {
        println!("[INSTALL] Adding --global flag");
        args.push("--global".to_string());
    }

    // Add --agent flag for each selected agent
    for agent in &agents {
        if agent == "global" {
            println!("[INSTALL] Skipping 'global' agent flag (already handled by --global)");
            continue;
        }
        println!("[INSTALL] Adding --agent flag: {}", agent);
        args.push("--agent".to_string());
        args.push(agent.clone());
    }

    if auto_confirm {
        println!("[INSTALL] Adding --yes flag");
        args.push("--yes".to_string());
    }

    // Convert to strict &str for Command
    let args_str: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    
    println!("[INSTALL] Full command: npx {}", args.join(" "));
    println!("[INSTALL] Spawning process...");

    // Windows 需要通过 cmd.exe 来执行 npx
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd");
        c.args(&["/C", "npx"]);
        c.args(&args_str);
        c
    } else {
        let mut c = Command::new("npx");
        c.args(&args_str);
        c
    };

    let mut child = cmd
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            println!("[INSTALL] ERROR: Failed to spawn npx: {}", e);
            format!("Failed to spawn npx: {}", e)
        })?;

    println!("[INSTALL] Process spawned successfully, PID: {:?}", child.id());

    {
        // Fallback input if flags don't cover everything
        if let Some(mut stdin) = child.stdin.take() {
            println!("[INSTALL] Writing newline to stdin...");
            let _ = stdin.write_all(b"\n");
        }
    }

    println!("[INSTALL] Waiting for process to complete...");
    let output = child
        .wait_with_output()
        .map_err(|e| {
            println!("[INSTALL] ERROR: Failed to read output: {}", e);
            format!("Failed to read output: {}", e)
        })?;

    println!("[INSTALL] Process completed with status: {:?}", output.status);
    
    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let stderr_str = String::from_utf8_lossy(&output.stderr);
    
    if !stdout_str.is_empty() {
        println!("[INSTALL] STDOUT:\n{}", stdout_str);
    }
    if !stderr_str.is_empty() {
        println!("[INSTALL] STDERR:\n{}", stderr_str);
    }

    if output.status.success() {
        println!("[INSTALL] SUCCESS: Installed {}", id);
        
        // Parse output to find installed skill IDs and save source
        // Output format example: ~\.agents\skills\agent-browser
        // Use regex to capture skill name
        let re = regex::Regex::new(r"[~\\]\.agents[\\/]skills[\\/]([a-zA-Z0-9_-]+)").unwrap();
        // Also try to match the source URL from "Source: <url>" lines if present, but user input `id` is usually the source URL
        // If `id` starts with http, we use it as source. 
        // If `id` is just a name and `skill` is none, `id` is the source.
        
        // Strategy: Use the input `id` as the source URL/command for all found skills.
        // This works perfectly for bulk install or single install.
        
        let mut installed_skills: std::collections::HashSet<String> = std::collections::HashSet::new();
        for cap in re.captures_iter(&stdout_str) {
            if let Some(skill_id) = cap.get(1) {
                installed_skills.insert(skill_id.as_str().to_string());
            }
        }
        
        // Also check if user provided a specific skill name via --skill
        if let Some(ref specific_skill) = skill {
            installed_skills.insert(specific_skill.clone());
        }

        // If no skills found in output but success, and `id` looks like a repo, maybe we can assume?
        // But npx usually prints paths.
        
        println!("[INSTALL] Identified installed skills: {:?}", installed_skills);
        
        for skill_id in installed_skills {
            save_skill_source(&skill_id, &id);
            println!("[INSTALL] Saved source for {}: {}", skill_id, id);
        }

        Ok(format!("Installed {}", id))
    } else {
        println!("[INSTALL] FAILED: Installation failed");
        Err(format!("Installation failed: {}", stderr_str))
    }
}

#[tauri::command]
async fn uninstall_skill(id: String, agents: Vec<String>) -> Result<String, String> {
    let home_dir = dirs::home_dir().ok_or("Could not find home directory")?;
    let mut messages = Vec::new();

    println!("Uninstalling skill: {} from agents={:?}", id, agents);

    for agent_name in &agents {
        // Find the relative path for this agent
        if let Some((_, relative_path)) = AGENT_PATHS.iter().find(|(name, _)| name == agent_name) {
            let skill_path = home_dir.join(relative_path).join(&id);

            if skill_path.exists() {
                match fs::remove_dir_all(&skill_path) {
                    Ok(_) => {
                        println!("Removed {} from {}", id, agent_name);
                        messages.push(format!("{}: Removed", agent_name));
                    }
                    Err(e) => {
                        println!("Failed to remove {} from {}: {}", id, agent_name, e);
                        messages.push(format!("{}: Error ({})", agent_name, e));
                    }
                }
            } else {
                println!(
                    "Skill {} not found in {} (path: {:?})",
                    id, agent_name, skill_path
                );
                messages.push(format!("{}: Not found", agent_name));
            }
        } else {
            messages.push(format!("{}: Unknown agent", agent_name));
        }
    }

    Ok(messages.join("\n"))
}

#[tauri::command]
async fn remove_skills(
    skill_ids: Vec<String>,
    global: bool,
    agents: Vec<String>,
    remove_all: bool,
    auto_confirm: bool,
) -> Result<String, String> {
    use std::io::Write;
    use std::process::{Command, Stdio};

    println!(
        "[REMOVE_SKILLS] Starting removal: skill_ids={:?}, global={}, agents={:?}, remove_all={}, auto_confirm={}",
        skill_ids, global, agents, remove_all, auto_confirm
    );

    let mut args = vec!["skills".to_string(), "remove".to_string()];

    // 处理 --all 参数
    if remove_all {
        println!("[REMOVE_SKILLS] Adding --all flag");
        args.push("--all".to_string());
    } else {
        // 添加技能ID列表
        for id in &skill_ids {
            println!("[REMOVE_SKILLS] Adding skill ID: {}", id);
            args.push(id.clone());
        }
    }

    // 添加 --global 参数
    if global {
        println!("[REMOVE_SKILLS] Adding --global flag");
        args.push("--global".to_string());
    }

    // 添加 --agent 参数
    for agent in &agents {
        println!("[REMOVE_SKILLS] Adding --agent flag: {}", agent);
        args.push("--agent".to_string());
        args.push(agent.clone());
    }

    // 添加 --yes 参数
    if auto_confirm {
        println!("[REMOVE_SKILLS] Adding --yes flag");
        args.push("--yes".to_string());
    }

    // Convert to strict &str for Command
    let args_str: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    
    println!("[REMOVE_SKILLS] Full command: npx {}", args.join(" "));
    println!("[REMOVE_SKILLS] Spawning process...");

    // Windows 需要通过 cmd.exe 来执行 npx
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd");
        c.args(&["/C", "npx"]);
        c.args(&args_str);
        c
    } else {
        let mut c = Command::new("npx");
        c.args(&args_str);
        c
    };

    let mut child = cmd
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            println!("[REMOVE_SKILLS] ERROR: Failed to spawn npx: {}", e);
            format!("Failed to spawn npx: {}", e)
        })?;

    println!("[REMOVE_SKILLS] Process spawned successfully, PID: {:?}", child.id());

    {
        // Fallback input if flags don't cover everything
        if let Some(mut stdin) = child.stdin.take() {
            println!("[REMOVE_SKILLS] Writing newline to stdin...");
            let _ = stdin.write_all(b"\n");
        }
    }

    println!("[REMOVE_SKILLS] Waiting for process to complete...");
    let output = child
        .wait_with_output()
        .map_err(|e| {
            println!("[REMOVE_SKILLS] ERROR: Failed to read output: {}", e);
            format!("Failed to read output: {}", e)
        })?;

    println!("[REMOVE_SKILLS] Process completed with status: {:?}", output.status);
    
    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let stderr_str = String::from_utf8_lossy(&output.stderr);
    
    if !stdout_str.is_empty() {
        println!("[REMOVE_SKILLS] STDOUT:\n{}", stdout_str);
    }
    if !stderr_str.is_empty() {
        println!("[REMOVE_SKILLS] STDERR:\n{}", stderr_str);
    }

    if output.status.success() {
        println!("[REMOVE_SKILLS] SUCCESS");
        Ok(format!("Successfully removed skills"))
    } else {
        println!("[REMOVE_SKILLS] FAILED: Removal failed");
        Err(format!("Removal failed: {}", stderr_str))
    }
}


#[derive(Debug, serde::Serialize)]
pub struct GlobalSkillInfo {
    id: String,
    name: String,
    description: String,
    used_by: Vec<String>,
    source: Option<String>,
}

#[tauri::command]
fn list_global_skills() -> Result<Vec<GlobalSkillInfo>, String> {
    let home_dir = dirs::home_dir().ok_or("Could not find home directory")?;
    let global_skills_path = home_dir.join(".agents").join("skills");
    
    if !global_skills_path.exists() {
        return Ok(Vec::new());
    }

    let mut global_skills = Vec::new();

    if let Ok(entries) = fs::read_dir(&global_skills_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let skill_id = path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                
                let skill_md_path = path.join("SKILL.md");
                
                if skill_md_path.exists() {
                    let content = fs::read_to_string(&skill_md_path).unwrap_or_default();
                    
                    let description = content
                        .lines()
                        .find(|l| l.starts_with("description:"))
                        .map(|l| l.replace("description:", "").trim().to_string())
                        .unwrap_or_else(|| "No description".to_string());

                    let name = content
                        .lines()
                        .find(|l| l.starts_with("name:"))
                        .map(|l| l.replace("name:", "").trim().to_string())
                        .unwrap_or_else(|| skill_id.clone());

                    // Find which agents are using this skill (via symlink)
                    let mut used_by = Vec::new();
                    for (agent_name, relative_path) in AGENT_PATHS {
                        let agent_skill_path = home_dir.join(relative_path).join(&skill_id);
                        if agent_skill_path.exists() {
                            // Check if it's a symlink pointing to global skills
                            if let Ok(metadata) = fs::symlink_metadata(&agent_skill_path) {
                                if metadata.file_type().is_symlink() {
                                    used_by.push(agent_name.to_string());
                                }
                            }
                        }
                    }

                    global_skills.push(GlobalSkillInfo {
                        id: skill_id,
                        name,
                        description,
                        used_by,
                        source: None, // Will be populated below if possible
                    });

                    // Try to get source for the last added skill
                    if let Some(last_skill) = global_skills.last_mut() {
                        let git_config_path = path.join(".git").join("config");
                        if git_config_path.exists() {
                            use std::process::Command;
                            let output = Command::new("git")
                                .args(&["-C", &path.to_string_lossy(), "remote", "get-url", "origin"])
                                .output();
                            if let Ok(out) = output {
                                if out.status.success() {
                                    last_skill.source = Some(String::from_utf8_lossy(&out.stdout).trim().to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(global_skills)
}

#[tauri::command]
async fn remove_global_skill(id: String) -> Result<String, String> {
    use std::process::{Command, Stdio};

    println!("[REMOVE_GLOBAL] Removing global skill: {}", id);

    let args = vec!["skills", "remove", "-g", &id];

    println!("[REMOVE_GLOBAL] Full command: npx {}", args.join(" "));

    // Windows 需要通过 cmd.exe 来执行 npx
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd");
        c.args(&["/C", "npx"]);
        c.args(&args);
        c
    } else {
        let mut c = Command::new("npx");
        c.args(&args);
        c
    };

    let output = cmd
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| {
            println!("[REMOVE_GLOBAL] ERROR: Failed to spawn npx: {}", e);
            format!("Failed to spawn npx: {}", e)
        })?;

    println!("[REMOVE_GLOBAL] Process completed with status: {:?}", output.status);
    
    let stdout_str = String::from_utf8_lossy(&output.stdout);
    let stderr_str = String::from_utf8_lossy(&output.stderr);
    
    if !stdout_str.is_empty() {
        println!("[REMOVE_GLOBAL] STDOUT:\n{}", stdout_str);
    }
    if !stderr_str.is_empty() {
        println!("[REMOVE_GLOBAL] STDERR:\n{}", stderr_str);
    }

    if output.status.success() {
        println!("[REMOVE_GLOBAL] SUCCESS: Removed {}", id);
        Ok(format!("Removed global skill: {}", id))
    } else {
        println!("[REMOVE_GLOBAL] FAILED: Removal failed");
        Err(format!("Removal failed: {}", stderr_str))
    }
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_local_skills,
            install_skill,
            uninstall_skill,
            remove_skills,
            list_global_skills,
            remove_global_skill
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
