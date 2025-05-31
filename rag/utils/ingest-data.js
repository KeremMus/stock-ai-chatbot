import { MongoClient } from 'mongodb';
import { getEmbedding } from './get-embeddings.js';

async function run() {
    const client = new MongoClient("mongodb+srv://keremcancu42:cancala450.@cluster0.cuy2i1y.mongodb.net/");

    try {
        // Connect to your Atlas cluster
        await client.connect();
        const db = client.db("TravelAgencyStock");
        
        // Get all collection names in the database
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(col => col.name);
        
        console.log(`Found ${collectionNames.length} collections:`, collectionNames);
        
        // Create or get the embeddings collection
        const embeddingsCollection = db.collection("embeddings");
        
        // Clear existing embeddings (optional - remove if you want to keep existing data)
        await embeddingsCollection.deleteMany({});
        console.log("Cleared existing embeddings collection");

        let totalProcessed = 0;
        
        // Process each collection
        for (const collectionName of collectionNames) {
            // Skip the embeddings collection itself
            if (collectionName === 'embeddings') {
                continue;
            }
            
            console.log(`\nProcessing collection: ${collectionName}`);
            const collection = db.collection(collectionName);
            
            // Get all documents from the collection
            const documents = await collection.find({}).toArray();
            console.log(`Found ${documents.length} documents in ${collectionName}`);
            
            if (documents.length === 0) {
                continue;
            }
            
            const insertDocuments = [];
            
            // Process documents one by one to avoid memory issues and add better debugging
            for (let i = 0; i < documents.length; i++) {
                const doc = documents[i];
                console.log(`Processing document ${i + 1}/${documents.length} in ${collectionName}`);
                
                try {
                    // Convert document to text for embedding
                    const textData = createTextFromDocument(doc);
                    console.log(`Text length: ${textData.length} characters`);
                    
                    if (!textData || textData.trim().length === 0) {
                        console.log(`Skipping document ${i + 1} in ${collectionName} - no text content`);
                        continue;
                    }
                    
                    // Limit text length to prevent issues
                    const maxLength = 1000;
                    const truncatedText = textData.length > maxLength ? 
                        textData.substring(0, maxLength) + "..." : textData;
                    
                    console.log(`Generating embedding for document ${i + 1}...`);
                    
                    // Add timeout to embedding generation
                    const embedding = await Promise.race([
                        getEmbedding(truncatedText),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Embedding generation timeout')), 30000)
                        )
                    ]);
                    
                    console.log(`✓ Generated embedding for document ${i + 1} (${embedding.length} dimensions)`);
                    
                    // Prepare document for insertion
                    insertDocuments.push({
                        source_collection: collectionName,
                        source_document_id: doc._id,
                        original_document: doc,
                        text_content: truncatedText,
                        embedding: embedding,
                        created_at: new Date()
                    });
                    
                } catch (error) {
                    console.error(`❌ Error processing document ${i + 1} in ${collectionName}:`, error.message);
                    // Continue with next document instead of stopping
                    continue;
                }
                
                // Insert in smaller batches to avoid memory issues
                if (insertDocuments.length >= 10) {
                    console.log(`Inserting batch of ${insertDocuments.length} documents...`);
                    const options = { ordered: false };
                    const result = await embeddingsCollection.insertMany(insertDocuments, options);
                    console.log(`✓ Inserted ${result.insertedCount} documents`);
                    totalProcessed += result.insertedCount;
                    insertDocuments.length = 0; // Clear the array
                }
            }
            
            // Insert remaining documents
            if (insertDocuments.length > 0) {
                console.log(`Inserting final batch of ${insertDocuments.length} documents...`);
                const options = { ordered: false };
                const result = await embeddingsCollection.insertMany(insertDocuments, options);
                console.log(`✓ Inserted ${result.insertedCount} documents from ${collectionName}`);
                totalProcessed += result.insertedCount;
            }
            
            console.log(`✅ Completed processing ${collectionName}`);
        }
        
        console.log(`\n🎉 Completed! Total documents processed: ${totalProcessed}`);
        
    } catch (err) {
        console.log("❌ Error:", err.stack);
    } finally {
        await client.close();
    }
}

// Helper function to convert a document to text for embedding generation
function createTextFromDocument(doc) {
    // Remove MongoDB _id field and other system fields
    const cleanDoc = { ...doc };
    delete cleanDoc._id;
    delete cleanDoc.__v;
    delete cleanDoc.createdAt;
    delete cleanDoc.updatedAt;
    
    // Convert the document to a readable text format
    const textParts = [];
    
    function processValue(key, value) {
        if (value === null || value === undefined) {
            return;
        }
        
        if (typeof value === 'string') {
            textParts.push(`${key}: ${value}`);
        } else if (typeof value === 'number') {
            textParts.push(`${key}: ${value}`);
        } else if (typeof value === 'boolean') {
            textParts.push(`${key}: ${value}`);
        } else if (Array.isArray(value)) {
            if (value.length > 0) {
                textParts.push(`${key}: ${value.join(', ')}`);
            }
        } else if (typeof value === 'object') {
            // For nested objects, flatten them
            Object.entries(value).forEach(([nestedKey, nestedValue]) => {
                processValue(`${key}_${nestedKey}`, nestedValue);
            });
        }
    }
    
    // Process all fields in the document
    Object.entries(cleanDoc).forEach(([key, value]) => {
        processValue(key, value);
    });
    
    return textParts.join('. ');
}

run().catch(console.dir);
