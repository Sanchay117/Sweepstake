import { loadFont as loadBesley } from "@remotion/google-fonts/Besley";
import { loadFont as loadPlex } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadScript } from "@remotion/google-fonts/PetitFormalScript";
import { loadFont as loadSerif } from "@remotion/google-fonts/SourceSerif4";

// The website's own type and ink (web/src/styles.css), so the film matches the page.
export const fonts = {
  display: loadBesley("normal", { weights: ["700", "800", "900"], subsets: ["latin"] }).fontFamily,
  script: loadScript("normal", { weights: ["400"], subsets: ["latin"] }).fontFamily,
  body: loadSerif("normal", { weights: ["400", "600"], subsets: ["latin"] }).fontFamily,
  mono: loadPlex("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily,
};
loadSerif("italic", { weights: ["400"], subsets: ["latin"] });

export const ink = {
  paper: "#f4ddb0",
  paperLight: "#f8ebcf",
  tint: "#edcfa2",
  tintDeep: "#e5c093",
  nasik: "#3f4489",
  nasikDeep: "#2a2e66",
  vermilion: "#b8432f",
  press: "#1d1b20",
};
