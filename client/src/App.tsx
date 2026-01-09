import { useEffect, useState } from "react";
import { Grid } from "./Grid";
import "./index.css";

export function App() {
  const [selected, setSelected] = useState<number>();
  const [width, setWidth] = useState(5);
  const [height, setHeight] = useState(3);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!["ArrowUp", "ArrowLeft", "ArrowRight", "ArrowDown"].includes(event.key)) return;
      if (selected === undefined) setSelected(0);
      else {
        let newSelected = selected;
        switch (event.key) {
          case "ArrowUp": {
            newSelected = selected - width;
            setSelected(newSelected);
            break;
          }
          case "ArrowLeft": {
            newSelected = selected - 1;
            break;
          }
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown)
  }, []);

  return (
    <div className="app">
      <Grid blocks={[]} width={width} height={height} selected={selected} setSelected={setSelected} />
    </div>
  );
}

export default App;
