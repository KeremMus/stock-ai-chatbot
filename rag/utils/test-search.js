import { searchEmbeddings, searchAndFormatContext } from './search-embeddings.js';

async function testSearch() {
    console.log("🔍 Testing search functionality...\n");

    const testQueries = [
        "pool maintenance",
        "kitchen equipment",
        "housekeeping services",
        "reception desk operations"
    ];

    for (const query of testQueries) {
        console.log(`\n📝 Testing query: "${query}"`);
        console.log("=" + "=".repeat(50));
        
        try {
            // Test raw search
            const results = await searchEmbeddings(query, 3, 0.5);
            console.log(`Found ${results.length} results`);
            
            if (results.length > 0) {
                results.forEach((result, index) => {
                    console.log(`\n${index + 1}. Collection: ${result.source_collection}`);
                    console.log(`   Score: ${result.score.toFixed(3)}`);
                    console.log(`   Text: ${result.text_content.substring(0, 100)}...`);
                });
            }
            
            // Test formatted context
            console.log("\n📋 Formatted context:");
            const context = await searchAndFormatContext(query, 2);
            console.log(context);
            
        } catch (error) {
            console.error(`❌ Error testing query "${query}":`, error.message);
        }
        
        console.log("\n" + "-".repeat(60));
    }
}

testSearch().catch(console.error); 