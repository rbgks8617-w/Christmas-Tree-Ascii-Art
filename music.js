"use strict";
const musicButton = document.querySelector("#music-toggle");
const musicStatus = document.querySelector("#music-status");
const volumeInput = document.querySelector("#music-volume");
const volumeValue = document.querySelector("#volume-value");
const musicAudio = document.querySelector("#background-music");
let musicVolume = 40, needsGesture = false, musicWanted = true, playAttempt = 0;
try {
  const saved = localStorage.getItem("tree-volume");
  if (saved !== null && Number.isFinite(Number(saved)))
    musicVolume = Math.max(0, Math.min(100, Number(saved)));
} catch (_) {}
function updateVolume() {
  volumeInput.value = musicVolume;
  volumeValue.textContent = musicVolume + "%";
  volumeInput.setAttribute("aria-valuetext", musicVolume + "%");
  musicAudio.volume = musicVolume / 100;
  musicAudio.muted = musicVolume === 0;
}
updateVolume();
volumeInput.addEventListener("input", () => {
  musicVolume = Number(volumeInput.value);
  updateVolume();
  try { localStorage.setItem("tree-volume", String(musicVolume)); } catch (_) {}
});
async function playMusic() {
  const attempt = ++playAttempt;
  musicWanted = true;
  needsGesture = false;
  musicButton.textContent = "음악 연결 중";
  try {
    await musicAudio.play();
  } catch (error) {
    if (attempt !== playAttempt || !musicWanted || error.name === "AbortError") return;
    musicButton.setAttribute("aria-pressed", "false");
    if (error.name === "NotAllowedError") {
      needsGesture = true;
      musicButton.textContent = "음악 켜기";
      musicStatus.textContent = "화면을 한 번 터치하면 음악이 시작돼요.";
    } else {
      musicButton.textContent = "음악 다시 시도";
      musicStatus.textContent = "음악 파일을 불러오지 못했어요.";
    }
  }
}
musicAudio.addEventListener("play", () => {
  needsGesture = false;
  musicButton.textContent = "음악 끄기";
  musicButton.setAttribute("aria-pressed", "true");
  musicStatus.textContent = "";
});
musicAudio.addEventListener("pause", () => {
  musicButton.textContent = "음악 켜기";
  musicButton.setAttribute("aria-pressed", "false");
});
musicAudio.addEventListener("error", () => {
  needsGesture = false;
  musicButton.textContent = "음악 다시 시도";
  musicButton.setAttribute("aria-pressed", "false");
  musicStatus.textContent = "음악 파일을 불러오지 못했어요.";
});
musicButton.addEventListener("click", () => {
  if (!musicAudio.paused) {
    musicWanted = needsGesture = false;
    playAttempt++;
    musicAudio.pause();
  } else {
    if (musicAudio.error) musicAudio.load();
    playMusic();
  }
});
function resumeAfterGesture(event) {
  if (needsGesture && musicWanted && event.target !== musicButton) playMusic();
}
document.addEventListener("pointerdown", resumeAfterGesture);
document.addEventListener("keydown", resumeAfterGesture);
playMusic();
