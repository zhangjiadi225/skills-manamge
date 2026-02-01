// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

use std::fs;
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
}

// Map of Agent Name -> Relative Path from Home
const AGENT_PATHS: &[(&str, &str)] = &[
    ("Antigravity", ".gemini/antigravity/global_skills"), // Adjusted based on user input
    ("Claude Code", ".claude/skills"),
    ("Cursor", ".cursor/skills"),
    ("Windsurf", ".codeium/windsurf/skills"),
    ("Trae", ".trae/skills"),
    ("Trae CN", ".trae-cn/skills"),
    ("Roo Code", ".roo/skills"),
    ("Cline", ".cline/skills"),
    ("Gemini CLI", ".gemini/skills"),
    ("GitHub Copilot", ".copilot/skills"),
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
    global: bool,
    agents: Vec<String>,
    auto_confirm: bool,
    install_mode: String,
) -> Result<String, String> {
    use std::io::Write;
    use std::process::{Command, Stdio};

    println!(
        "Installing skill: {} (mode={}) with global={}, agents={:?}, auto_confirm={}",
        id, install_mode, global, agents, auto_confirm
    );

    let mut args = vec!["skills".to_string(), "add".to_string(), id.clone()];
    if global {
        args.push("--global".to_string());
    }

    // Add --agent flag for each selected agent
    for agent in agents {
        args.push("--agent".to_string());
        args.push(agent);
    }

    if auto_confirm {
        args.push("--yes".to_string());
    }

    // Convert to strict &str for Command
    let args_str: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    let mut child = Command::new("npx.cmd")
        .args(&args_str)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn npx: {}", e))?;

    {
        // Fallback input if flags don't cover everything
        if let Some(mut stdin) = child.stdin.take() {
            let _ = stdin.write_all(b"\n");
        }
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to read output: {}", e))?;

    if output.status.success() {
        Ok(format!("Installed {}", id))
    } else {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        Err(format!("Installation failed: {}", err_msg))
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_local_skills,
            install_skill,
            uninstall_skill
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
