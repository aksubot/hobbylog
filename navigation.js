const menuButton = document.querySelector("#toggle-nav");
const mainNav = document.querySelector("#main-nav");

function setMenuOpen(isOpen) {
  menuButton.setAttribute("aria-expanded", String(isOpen));
  menuButton.setAttribute("aria-label", isOpen ? "Close tracker menu" : "Open tracker menu");
  mainNav.classList.toggle("is-open", isOpen);
}

menuButton.addEventListener("click", () => {
  setMenuOpen(menuButton.getAttribute("aria-expanded") !== "true");
});

mainNav.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.closest("a")) setMenuOpen(false);
});

document.addEventListener("click", (event) => {
  if (!mainNav.contains(event.target) && !menuButton.contains(event.target)) setMenuOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMenuOpen(false);
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 780) setMenuOpen(false);
});
