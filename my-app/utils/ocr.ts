import { createWorker, createScheduler } from 'tesseract.js';

export async function performOCR(imageUrl: string, language: string = 'deu'): Promise<string> {
  const scheduler = createScheduler();
  const worker1 = await createWorker(language);
  const worker2 = await createWorker(language);
  
  scheduler.addWorker(worker1);
  scheduler.addWorker(worker2);

  try {
    const { data: { text } } = await scheduler.addJob('recognize', imageUrl, {
      tessedit_pageseg_mode: '1',
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÄÖÜäöüß0123456789.,!?-:;() ',
      tessedit_ocr_engine_mode: '2',
    });
    return text;
  } finally {
    await scheduler.terminate();
  }
}

