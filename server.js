import app from "./app.js";

const app = express();
const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Servidor backend en http://localhost:${PORT}`);
});