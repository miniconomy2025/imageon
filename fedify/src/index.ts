import app from "./app.ts";
import "./logging.ts";

app.listen(8001, () => {
  console.log("Server started at http://localhost:8001");
});
