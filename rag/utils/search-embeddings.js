import { MongoClient } from 'mongodb';
import { getEmbedding } from './get-embeddings.js';

/**
 * Fallback search using text matching when vector search is not available
 * @param {string} query - The user's search query
 * @param {number} limit - Maximum number of results to return
 * @returns {Promise<Array>} Array of relevant documents
 */
async function fallbackTextSearch(query, limit = 5) {
    const client = new MongoClient(process.env.ATLAS_CONNECTION_STRING || "mongodb+srv://keremcancu42:cancala450.@cluster0.cuy2i1y.mongodb.net/");

    try {
        await client.connect();
        const db = client.db("TravelAgencyStock");
        const collection = db.collection("embeddings");

        // Create a text search using regex on the text_content field
        const searchRegex = new RegExp(query.split(' ').join('|'), 'i');
        
        const results = await collection.find({
            text_content: { $regex: searchRegex }
        })
        .limit(limit)
        .toArray();

        // Add a mock score for consistency
        return results.map(result => ({
            ...result,
            score: 0.8 // Mock score since we can't calculate actual similarity
        }));

    } catch (error) {
        console.error("Error in fallback text search:", error);
        throw error;
    } finally {
        await client.close();
    }
}

/**
 * Search for relevant documents using vector similarity search
 * @param {string} query - The user's search query
 * @param {number} limit - Maximum number of results to return (default: 5)
 * @param {number} minScore - Minimum similarity score threshold (default: 0.7)
 * @returns {Promise<Array>} Array of relevant documents with scores
 */
export async function searchEmbeddings(query, limit = 5, minScore = 0.5) {
    const client = new MongoClient(process.env.ATLAS_CONNECTION_STRING || "mongodb+srv://keremcancu42:cancala450.@cluster0.cuy2i1y.mongodb.net/");

    try {
        await client.connect();
        const db = client.db("TravelAgencyStock");
        const collection = db.collection("embeddings");

        // Generate embedding for the search query
        console.log("Generating embedding for search query...");
        const queryEmbedding = await getEmbedding(query);

        // Perform vector search using MongoDB Atlas Search
        const pipeline = [
            {
                $vectorSearch: {
                    index: "index1", // Replace with your actual index name
                    path: "embedding",
                    queryVector: queryEmbedding,
                    numCandidates: 100,
                    limit: limit
                }
            },
            {
                $addFields: {
                    score: { $meta: "vectorSearchScore" }
                }
            },
            {
                $match: {
                    score: { $gte: minScore }
                }
            },
            {
                $project: {
                    source_collection: 1,
                    source_document_id: 1,
                    original_document: 1,
                    text_content: 1,
                    score: 1,
                    created_at: 1
                }
            }
        ];

        const results = await collection.aggregate(pipeline).toArray();
        
        console.log(`Found ${results.length} relevant documents`);
        
        return results;

    } catch (error) {
        console.error("Error searching embeddings:", error);
        
        // If vector search fails due to missing index, fall back to text search
        if (error.message && error.message.includes('embedding is not indexed as knnVector')) {
            console.log("Vector search index not found. Falling back to text search...");
            await client.close(); // Close the current connection
            return await fallbackTextSearch(query, limit);
        }
        
        throw error;
    } finally {
        await client.close();
    }
}

/**
 * Search and format results for chatbot context
 * @param {string} query - The user's search query
 * @param {number} limit - Maximum number of results to return
 * @returns {Promise<string>} Formatted context string for the chatbot
 */
export async function searchAndFormatContext(query, limit = 3) {
    try {
        const results = await searchEmbeddings(query, limit, 0.2); // Lower threshold for fallback
        
        if (results.length === 0) {
            return "No relevant information found in the database.";
        }

        let context = "Based on the available information:\n\n";
        
        results.forEach((result, index) => {
            context += `${index + 1}. From ${result.source_collection} collection:\n`;
            context += `   ${result.text_content}\n`;
            if (result.score !== 0.8) { // Don't show mock scores
                context += `   (Relevance score: ${result.score.toFixed(3)})\n\n`;
            } else {
                context += `   (Text match found)\n\n`;
            }
        });

        return context;
        
    } catch (error) {
        console.error("Error formatting search context:", error);
        return "Error retrieving information from the database.";
    }
}

/**
 * Get detailed document information by collection and ID
 * @param {string} collectionName - Name of the source collection
 * @param {string} documentId - ID of the document
 * @returns {Promise<Object|null>} The full document or null if not found
 */
export async function getDocumentDetails(collectionName, documentId) {
    const client = new MongoClient(process.env.ATLAS_CONNECTION_STRING || "mongodb+srv://keremcancu42:cancala450.@cluster0.cuy2i1y.mongodb.net/");

    try {
        await client.connect();
        const db = client.db("TravelAgencyStock");
        const collection = db.collection(collectionName);

        const document = await collection.findOne({ _id: documentId });
        return document;

    } catch (error) {
        console.error("Error getting document details:", error);
        return null;
    } finally {
        await client.close();
    }
} 