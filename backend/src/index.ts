import express from "express";
import profileRoutes from "./routes/userRoutes";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use("/api", profileRoutes);

app.get("/health", (_req, res) => res.send("OK"));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
