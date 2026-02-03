import { useAppStore } from "./store/app-store";
import { Shell } from "./components/layout/Shell";
import Discover from "./pages/Discover";
import Settings from "./pages/Settings";

function App() {
  const { currentView } = useAppStore();

  return (
    <Shell>
      {(currentView === "discover" || currentView === "library") && <Discover />}
      {currentView === "settings" && <Settings />}
    </Shell>
  );
}

export default App;
