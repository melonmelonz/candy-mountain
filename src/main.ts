const app = document.getElementById("app")!;
const canvas = document.createElement("canvas");
app.appendChild(canvas);
const ctx = canvas.getContext("2d")!;
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();
ctx.fillStyle = "#7c5cff";
ctx.font = "16px system-ui";
ctx.fillText("candy mountain: scaffolding", 24, 40);
