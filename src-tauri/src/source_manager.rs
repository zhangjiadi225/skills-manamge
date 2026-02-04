use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

// ... existing imports ...

// Helper function to get the skill sources file path
fn get_skill_sources_path() -> Option<PathBuf> {
    dirs::home_dir().map(|home| home.join(".gemini").join("antigravity").join("skill_sources.json"))
}

// Ensure the directory exists
fn ensure_sources_dir_exists() {
    if let Some(path) = get_skill_sources_path() {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
    }
}

pub fn save_skill_source(skill_id: &str, source: &str) {
    ensure_sources_dir_exists();
    if let Some(path) = get_skill_sources_path() {
        let mut sources: HashMap<String, String> = if path.exists() {
            fs::read_to_string(&path)
                .ok()
                .and_then(|content| serde_json::from_str(&content).ok())
                .unwrap_or_default()
        } else {
            HashMap::new()
        };

        sources.insert(skill_id.to_string(), source.to_string());

        if let Ok(content) = serde_json::to_string_pretty(&sources) {
            let _ = fs::write(path, content);
        }
    }
}

pub fn get_skill_source(skill_id: &str) -> Option<String> {
    if let Some(path) = get_skill_sources_path() {
        if path.exists() {
            let sources: HashMap<String, String> = fs::read_to_string(path)
                .ok()
                .and_then(|content| serde_json::from_str(&content).ok())
                .unwrap_or_default();
            return sources.get(skill_id).cloned();
        }
    }
    None
}
