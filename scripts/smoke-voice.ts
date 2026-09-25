process.loadEnvFile(".env.local");
delete process.env.E2E_MOCK_MODE;

import { synthesize } from "../lib/voice/tts";
import { transcribe } from "../lib/voice/asr";

async function main() {
  console.log("=== Voice Smoke Test ===");

  // TTS test
  try {
    const start = Date.now();
    const audio = await synthesize("你好，欢迎来到职业导航助手。");
    const ms = Date.now() - start;
    console.log(`TTS: OK, ${audio.length} bytes, ${ms}ms`);
  } catch (e) {
    console.log(`TTS: FAIL - ${e instanceof Error ? e.message : e}`);
  }

  // ASR test - synthesize first, then transcribe the audio
  // Use a minimal WAV header with silence for testing
  try {
    const start = Date.now();
    const ttsAudio = await synthesize("测试语音识别功能");
    const result = await transcribe(ttsAudio, "audio/mpeg");
    const ms = Date.now() - start;
    console.log(`ASR: OK, text="${result}", ${ms}ms`);
  } catch (e) {
    console.log(`ASR: FAIL - ${e instanceof Error ? e.message : e}`);
  }

  console.log("=== Done ===");
}

main().catch(console.error);
