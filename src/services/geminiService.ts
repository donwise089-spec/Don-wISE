import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface RizzLine {
  type: string;
  text: string;
}

export async function analyzeConversationAndGenerateRizz(base64Data: string, mimeType: string, platform?: string, voiceInput?: string): Promise<RizzLine[]> {
  const platformContext = platform 
    ? `The user specified this is for ${platform.toUpperCase()}. 
       ${platform.toLowerCase().includes('instagram') 
          ? "Include strategies like story replies or commenting on shared interests/locations. Keep it authentic for a social platform." 
          : "Tailor the lines to the specific cultural norms of this dating app (e.g., prompt replies for Hinge, witty openers for Tinder)."
       }`
    : "Identify the platform (Tinder, Hinge, iMessage, etc.) from the visual context and adjust the strategy accordingly.";

  const voiceContext = voiceInput 
    ? "ANALYSIS ALERT: An additional audio recording or transcript has been provided. Prioritize analyzing the speaker's vocal tone, emotion, pace, and any specific spoken keywords. Look for 'Audio-Specific' hooks that reference how they said something, not just what was visible."
    : "";

  const prompt = `
    You are an expert social strategist and dating coach with high emotional intelligence.
    
    PLATFORM CONTEXT:
    ${platformContext}

    ${voiceContext}

    TASK:
    Analyze the provided ${mimeType.startsWith('video/') ? 'video' : 'screenshot'} of a dating app profile (Tinder, Hinge, Bumble) or a text conversation.
    
    ANALYSIS REQUIREMENTS:
    1. Identify the Context: Is this an opening move, a reply, or an ongoing conversation?
    2. Dynamic Element Extraction (CRITICAL for Video/Audio):
       - Observe body language: Posture, confidence level, or subtle cues like hair-flipping or eye contact.
       - Analyze gestures and facial expressions: Micro-expressions of joy, sarcasm, or shyness.
       - Environmental Interactions: How they interact with their surroundings or items in the video.
       - Audio/Visual Tone: Listen for vocal inflection, laughter, or tone shifts. If silent, infer emotional cues from visual pacing. If audio/voice is provided, analyze the spoken words and vocal subtext (enthusiasm, hesitation, sarcasm).
    3. Read the Vibe: Is the energy peaking? Is there a tension shift? Capture the evolution of the mood.
    
    GENERATION GUIDELINES:
    - Generate 3 distinct "rizz" lines that feel like they come from a place of deep observation.
    - VIDEO/AUDIO-FIRST STRATEGY: If media is a video or has audio, lines MUST comment on specific actions, gestures, tone shifts, or spoken phrases.
    - PLATFORM-SPECIFICITY: Adapt to the platform's standard (e.g. story replies for IG, bio-links for Tinder).
    - NO GENERICS: Every line MUST reference a detail unique to this specific piece of media.
    - VARIETY: 
        - Line 1 (The Moment): Reference a specific frame, gesture, or spoken word that felt authentic.
        - Line 2 (The Energy Catch): Comment on the overall "vibe" or personality trait revealed by their movement/voice.
        - Line 3 (Smooth Bridge/Audio Hook): Turn an environmental detail or a specific vocal cue into a compelling follow-up.
    - TONE: Charismatic, confident, and slightly "cheeky." Avoid being overly formal or "cringey."
    
    OUTPUT:
    Return a JSON array of exactly 3 objects: { "type": string, "text": string }.
    Types should reflect the strategy used (e.g., "Observational", "Voice Insight", "The Tease", "Smooth Operator", "Witty Reply").
  `;

  try {
    const parts: any[] = [
      { inlineData: { data: base64Data.split(',')[1] || base64Data, mimeType } }
    ];

    if (voiceInput) {
      // Determine if voice input is audio or text (assuming audio/mpeg for voice recordings)
      const voiceMimeType = voiceInput.startsWith('data:audio/') 
        ? voiceInput.split(';')[0].split(':')[1] 
        : 'text/plain';
      
      if (voiceMimeType === 'text/plain') {
        parts.push({ text: `Voice Transcript: ${voiceInput}` });
      } else {
        parts.push({ inlineData: { data: voiceInput.split(',')[1] || voiceInput, mimeType: voiceMimeType } });
      }
    }

    parts.push({ text: prompt });

    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "A list of exactly 3 unique and highly personalized rizz lines.",
          items: {
            type: Type.OBJECT,
            properties: {
              type: { 
                type: Type.STRING, 
                description: "The strategic approach used (e.g., 'The Moment', 'Energy Catch', 'Voice Insight', 'Smooth Bridge', 'Micro-Expression Detail')." 
              },
              text: { 
                type: Type.STRING, 
                description: "The highly personalized rizz line referencing specific visual, dynamic, or auditory details from the provided media." 
              }
            },
            required: ["type", "text"]
          },
          minItems: 3,
          maxItems: 3
        }
      }
    });

    const text = result.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Failed to analyze the media. Make sure the text or profile is clearly visible.");
  }
}
