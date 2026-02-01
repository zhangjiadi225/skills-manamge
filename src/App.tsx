import { useAppStore } from "./store/app-store";
import { Shell } from "./components/layout/Shell";
import Discover from "./pages/Discover";
const Library = () => <div className="p-8"><h2 className="text-2xl font-bold mb-4">Library</h2></div>;
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
