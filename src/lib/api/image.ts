/**
 * Copyright 2025 Mike Odnis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { type } from "arktype";
import { Error } from "effect/Data";
import { v4 as uuidv4 } from "uuid";

// --- ArkType Schemas for Data Validation ---

const ForeignKeys = type({
	productId: "string.uuid.v4",
	categoryId: "string.uuid.v4",
	brandId: "string.uuid.v4",
	locationId: "string.uuid.v4",
});

const ImageAnalysisResult = type({
	uuid: "string.uuid.v4",
	rawAnalysis: "string|undefined",
	timestamp: "string",
	processingStatus: "'completed' | 'failed'",
});

const InitialResults = type({
	uuid: "string.uuid.v4",
	parentUuid: "string.uuid",
	results: "unknown",
	timestamp: "string",
	processingStatus: "'completed' | 'failed'",
});

const MetadataResults = type({
	uuid: "string.uuid.v4",
	parentUuid: "string.uuid.v4",
	imageUuid: "string.uuid.v4",
	metadata: "unknown", // The AI's output is unstructured
	foreignKeys: ForeignKeys, // Compose the ForeignKeys schema
	timestamp: "string",
	processingStatus: "'completed' | 'failed'",
});

const PipelineSummary = type({
	uuid: "string.uuid.v4",
	categories: ["string", "[]"],
	confidence: "number",
	processingTime: "string",
});

const PipelineResult = type({
	pipeline: {
		imageAnalysis: ImageAnalysisResult,
		initialResults: InitialResults,
		metadata: MetadataResults,
	},
	summary: PipelineSummary,
});

// --- Infer TypeScript types from ArkType schemas ---
type ImageAnalysisResult = typeof ImageAnalysisResult.infer;
type InitialResults = typeof InitialResults.infer;
type MetadataResults = typeof MetadataResults.infer;
type ForeignKeys = typeof ForeignKeys.infer;
type PipelineResult = typeof PipelineResult.infer;

class ImageContextExtractor {
	private ai: GoogleGenAI;
	private model: string;

	constructor(apiKey: string) {
		this.ai = new GoogleGenAI({
			apiKey: apiKey || Bun.env.GEMINI_API_KEY,
		});
		this.model = "gemini-2.0-flash-exp";
	}

	/**
	 * Process image similar to Google Lens - identify objects, text, and context
	 * @param imagePath - Path to image file or image buffer
	 * @returns Validated initial processing results
	 */
	async processImage(imagePath: string | Buffer): Promise<ImageAnalysisResult> {
		try {
			let imageData: string;
			if (typeof imagePath === "string") {
				const imageBuffer = fs.readFileSync(imagePath);
				imageData = imageBuffer.toString("base64");
			} else {
				imageData = imagePath.toString("base64");
			}

			const response: any = await this.ai.models.generateContent({
				model: this.model,
				contents: [
					{
						parts: [
							{
								text: `Analyze this image like Google Lens would. Identify:
              1. All visible products, brands, and text
              2. Product categories (food, clothing, technology, drugs/medicine, etc.)
              3. Any readable text, labels, or signs
              4. Visual context and setting
              5. Potential shopping/commercial elements
              
              Format your response as structured data that can be easily parsed.`,
							},
							{
								inlineData: {
									mimeType: "image/jpeg", // Adjust based on actual image type
									data: imageData,
								},
							},
						],
					},
				],
				config: {
					systemInstruction: `You are an expert image analysis system similar to Google Lens. 
          Focus on identifying products, brands, text, and commercial elements in images. 
          Provide structured, actionable data for product categorization and information retrieval.`,
					maxOutputTokens: 4096,
				},
			});

			const analysisText: string | undefined =
				response.candidates?.[0]?.content?.parts?.[0]?.text;

			const resultObject = {
				uuid: uuidv4(),
				rawAnalysis: analysisText,
				timestamp: new Date().toISOString(),
				processingStatus: "completed" as const,
			};

			const data = ImageAnalysisResult.assert(resultObject);
			if (!data) {
				throw new Error(
					`Internal data validation failed for ImageAnalysisResult`,
				);
			}
			return data;
		} catch (error) {
			if (error instanceof Error) {
				console.error("Error processing image:", error);
				throw new Error(`Image processing failed: ${error.message}`);
			} else {
				console.error("Error processing image:", error);
				throw new Error("Image processing failed: Unknown error");
			}
		}
	}

	/**
	 * Generate initial top results based on image analysis
	 * @param imageAnalysis - Validated results from processImage
	 * @returns Validated top search results and suggestions
	 */
	async generateInitialResults(
		imageAnalysis: ImageAnalysisResult,
	): Promise<InitialResults> {
		try {
			const response: any = await this.ai.models.generateContent({
				model: this.model,
				contents: [
					{
						parts: [
							{
								text: `Based on this image analysis, generate the top 5-10 most relevant search results and product matches:
            
            Analysis: ${imageAnalysis.rawAnalysis}
            
            Provide:
            1. Top product matches with confidence scores
            2. Suggested search queries
            3. Relevant categories
            4. Key identifying features
            5. Potential brand matches
            
            Format as JSON with clear structure for downstream processing.`,
							},
						],
					},
				],
				config: {
					systemInstruction: `Generate structured search results and product matches based on image analysis. 
          Focus on actionable results that can be used for product categorization and information retrieval.
          Prioritize accuracy and relevance.`,
					maxOutputTokens: 4096,
				},
			});

			const resultsText: string | undefined =
				response.candidates?.[0]?.content?.parts?.[0]?.text;

			const resultObject = {
				uuid: uuidv4(),
				parentUuid: imageAnalysis.uuid,
				results: this.parseResults(resultsText),
				timestamp: new Date().toISOString(),
				processingStatus: "completed" as const,
			};

			// Validate the created object at runtime
			const res = InitialResults.assert(resultObject);
			if (!res) {
				throw new Error(`Internal data validation failed for InitialResults`);
			}
			return res;
		} catch (error) {
			if (error instanceof Error) {
				console.error("Error generating initial results:", error);
				throw new Error(`Results generation failed: ${error.message}`);
			} else {
				console.error("Error generating initial results:", error);
				throw new Error("Results generation failed: Unknown error");
			}
		}
	}

	/**
	 * Extract structured metadata from results
	 * @param initialResults - Validated results from generateInitialResults
	 * @returns Validated, extracted, and structured metadata
	 */
	async extractMetadata(
		initialResults: InitialResults,
	): Promise<MetadataResults> {
		try {
			const response: any = await this.ai.models.generateContent({
				model: this.model,
				contents: [
					{
						parts: [
							{
								text: `Extract structured metadata from these search results for database storage and categorization:
            
            Results: ${JSON.stringify(initialResults.results, null, 2)}
            
            Extract:
            1. Product categories (food, clothes, drugs, technology, etc.)
            2. Brand information and confidence levels
            3. Key attributes and features
            4. Price-related information if available
            5. Location-relevant data
            6. Nutritional info (for food)
            7. Technical specifications (for technology)
            8. Foreign key relationships for database storage
            
            Format as structured JSON with clear field mappings.`,
							},
						],
					},
				],
				config: {
					systemInstruction: `Extract and structure metadata for database storage and product categorization.
          Focus on creating clean, normalized data with proper foreign key relationships.
          Ensure all extracted data is actionable for the downstream pipeline.`,
					maxOutputTokens: 4096,
				},
			});

			const metadataText: string | undefined =
				response.candidates?.[0]?.content?.parts?.[0]?.text;

			const resultObject = {
				uuid: uuidv4(),
				parentUuid: initialResults.uuid,
				imageUuid: initialResults.parentUuid,
				metadata: this.parseMetadata(metadataText),
				foreignKeys: this.generateForeignKeys(metadataText),
				timestamp: new Date().toISOString(),
				processingStatus: "completed" as const,
			};

			// Validate the created object at runtime
			const res = MetadataResults.assert(resultObject);
			if (!res) {
				throw new Error(`Internal data validation failed for MetadataResults`);
			}
			return res;
		} catch (error) {
			if (error instanceof Error) {
				console.error("Error extracting metadata:", error);
				throw new Error(`Metadata extraction failed: ${error.message}`);
			} else {
				console.error("Error extracting metadata:", error);
				throw new Error("Metadata extraction failed: Unknown error");
			}
		}
	}

	/**
	 * Complete pipeline from image to metadata
	 * @param imagePath - Path to image or image buffer
	 * @returns Complete and validated processing results
	 */
	async processImagePipeline(
		imagePath: string | Buffer,
	): Promise<PipelineResult> {
		try {
			console.log("🔄 Processing image...");
			const imageAnalysis = await this.processImage(imagePath);

			console.log("🔄 Generating initial results...");
			const initialResults = await this.generateInitialResults(imageAnalysis);

			console.log("🔄 Extracting metadata...");
			const metadata = await this.extractMetadata(initialResults);

			// Safely access the 'unknown' metadata property
			const md = metadata.metadata as any;
			const categories = Array.isArray(md?.categories) ? md.categories : [];
			const confidence = typeof md?.confidence === "number" ? md.confidence : 0;

			const resultObject = {
				pipeline: {
					imageAnalysis,
					initialResults,
					metadata,
				},
				summary: {
					uuid: imageAnalysis.uuid,
					categories: categories,
					confidence: confidence,
					processingTime: new Date().toISOString(),
				},
			};

			// Validate the final composed object
			const res = PipelineResult.assert(resultObject);
			if (!res) {
				throw new Error(
					`Internal data validation failed for final PipelineResult`,
				);
			}
			return res;
		} catch (error) {
			if (error instanceof Error) {
				console.error("Pipeline processing failed:", error);
				throw error;
			} else {
				console.error("Pipeline processing failed:", error);
				throw new Error("Pipeline processing failed: Unknown error");
			}
		}
	}

	// Helper methods remain the same
	private parseResults(resultsText: string | undefined): unknown {
		if (!resultsText) return { raw: "" };
		try {
			const jsonMatch = resultsText.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				return JSON.parse(jsonMatch[0]);
			}
			return { raw: resultsText };
		} catch (error) {
			return { raw: resultsText };
		}
	}

	private parseMetadata(metadataText: string | undefined): unknown {
		if (!metadataText) return { raw: "" };
		try {
			const jsonMatch = metadataText.match(/\{[\s\S]*\}/);
			if (jsonMatch) {
				return JSON.parse(jsonMatch[0]);
			}
			return { raw: metadataText };
		} catch (error) {
			return { raw: metadataText };
		}
	}

	private generateForeignKeys(_metadataText: string | undefined): ForeignKeys {
		return {
			productId: uuidv4(),
			categoryId: uuidv4(),
			brandId: uuidv4(),
			locationId: uuidv4(),
		};
	}
}

// ... (Usage example remains the same)
// if (require.main === module) {
//   (async () => {
//     try {
//       const apiKey = Bun.env.GEMINI_API_KEY;
//       const extractor = new ImageContextExtractor(apiKey);
//       const imagePath = './test_image.jpg';

//       if (!fs.existsSync(imagePath)) {
//         console.log('⚠️  Sample image not found.');
//         return;
//       }

//       const result = await extractor.processImagePipeline(imagePath);

//       console.log('✅ Pipeline completed successfully!');
//       console.log('📊 Summary:', JSON.stringify(result.summary, null, 2));

//     } catch (error: unknown) {
//       if (error instanceof Error) {
//         console.error('❌ Pipeline failed:', error.message);
//       } else {
//         console.error('❌ Pipeline failed:', error);
//       }
//     }
//   })();
// }

export default ImageContextExtractor;
