// Vite root entry (renderer/index.html loads this as <script type="module">).
// 逻辑按 feature 拆在 ./src/ 下；本文件只做引导。
import { bootstrap } from "./src/app.js";

bootstrap();
