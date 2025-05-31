import { tool } from 'ai';
import { z } from 'zod';

const searchDatabaseSchema = z.object({
  query: z.string().describe('The search query to find relevant information'),
  limit: z.number().optional().default(3).describe('Maximum number of results to return'),
});

export const searchDatabase = tool({
  description: 'Search the travel agency database for relevant information about pools, kitchens, housekeeping, and reception services',
  parameters: searchDatabaseSchema,
  execute: async ({ query, limit }) => {
    try {
      // Import the search function dynamically to avoid module resolution issues
      const { searchAndFormatContext } = await import('../../../rag/utils/search-embeddings.js');
      
      const context = await searchAndFormatContext(query, limit);
      
      return {
        success: true,
        context,
        query,
        resultsCount: limit
      };
    } catch (error) {
      console.error('Error searching database:', error);
      return {
        success: false,
        error: 'Failed to search the database',
        context: 'Unable to retrieve information from the database at this time.'
      };
    }
  },
}); 