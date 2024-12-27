import { NextResponse } from 'next/server';
import { performOCR } from '../../../utils/ocr';

export async function POST(request: Request) {
  try {
    const { imageUrl, language = 'deu' } = await request.json();
    
    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    const extractedText = await performOCR(imageUrl, language);
    
    return NextResponse.json({ text: extractedText });
  } catch (error) {
    console.error('Error in analyze-image route:', error);
    return NextResponse.json({ error: 'Failed to analyze image' }, { status: 500 });
  }
}

