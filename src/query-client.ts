import { defaultShouldDehydrateQuery, MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import SuperJSON from "superjson";
import { cache } from 'react';

// const fetchWithSuperJSON = async (url: string): Promise<any> => {
//   const response = await fetch(url);
//   if (!response.ok) {
//     throw new Error('Network response was not ok');
//   }

//   const contentType = response.headers.get('Content-Type');
//   if (!contentType || !contentType.includes('application/json')) {
//     throw new Error('Response is not JSON');
//   }

//   const text = await response.text();
//   try {
//     return SuperJSON.parse(text);
//   } catch (error) {
//     console.error('Failed to parse response as SuperJSON:', error);
//     throw new Error('Failed to parse response');
//   }
// };

export const createQueryClient = cache(() => {
  let queryClient: QueryClient | null = null;

  return (): QueryClient => {
    if (!queryClient) {
      queryClient = new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            console.error(`Query error: ${error}`, query);
          },
          onSuccess: (data, query) => {
            console.debug(`Query success`, { data, query });
          },
          onSettled: (data, error, query) => {
            console.debug(`Query settled`, { data, error, query });
          }
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            console.error(`Mutation error: ${error}`, { message: error.message, stack: error.stack });
            return Promise.resolve();
          },
          onSuccess: (data, variables, context, mutation) => {
            console.info(
              "Mutation succeeded",
              {
                data,
                variables,
                context,
                mutationKey: mutation?.options?.mutationKey,
                mutationFn: mutation?.options?.mutationFn?.name || "anonymous"
              }
            );
            return Promise.resolve();
          }
        }),
        defaultOptions: {
          dehydrate: {
            serializeData: SuperJSON.serialize,
            shouldDehydrateQuery: (query) =>
              typeof defaultShouldDehydrateQuery !== "undefined"
                ? defaultShouldDehydrateQuery(query) || query.state.status === 'pending'
                : query.state.status === 'pending',
          },
          hydrate: {
            deserializeData: SuperJSON.deserialize,
          },
        },
      });
    }
    return queryClient;
  };
})();