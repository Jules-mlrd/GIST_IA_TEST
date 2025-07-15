const { dequeuePreanalysisTask, setPreanalysisStatus, extractAndAnalyzeDocument } = require('./lib/utils');

async function main() {
  while (true) {
    const task = await dequeuePreanalysisTask();
    if (!task) {
      await new Promise(res => setTimeout(res, 2000));
      continue;
    }
    const { fileName, mimeType, buffer } = task;
    try {
      await setPreanalysisStatus(fileName, 'processing');
      const result = await extractAndAnalyzeDocument(buffer, fileName, mimeType);
      await setPreanalysisStatus(fileName, result.error ? 'error' : 'done');
      console.log(`[PREANALYSIS] ${fileName} : ${result.error ? 'error' : 'done'}`);
    } catch (e) {
      await setPreanalysisStatus(fileName, 'error');
      console.error(`[PREANALYSIS] ${fileName} : error`, e);
    }
  }
}

main(); 