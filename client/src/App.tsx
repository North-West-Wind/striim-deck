import { Grid } from "./Grid";
import "./index.css";

export function App() {
  return (
    <div className="app">
      <Grid blocks={[]} width={5} height={3} />
    </div>
  );
}

export default App;
