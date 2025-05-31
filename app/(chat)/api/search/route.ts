import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { query, limit = 3 } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    // Import the search function dynamically
    const { searchEmbeddings, searchAndFormatContext } = await import('../../../../rag/utils/search-embeddings.js');

    // Get raw search results
    const results = await searchEmbeddings(query, limit);
    
    // Get formatted context
    const context = await searchAndFormatContext(query, limit);

    return NextResponse.json({
      success: true,
      query,
      resultsCount: results.length,
      results: results.map(result => ({
        collection: result.source_collection,
        score: result.score,
        text: result.text_content,
        documentId: result.source_document_id
      })),
      formattedContext: context
    });

  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to search database',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Search API is running. Use POST with { "query": "your search term" }'
  });
} 