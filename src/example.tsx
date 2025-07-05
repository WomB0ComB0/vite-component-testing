import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import DataLoader, { useDataLoader } from './effect-data-loader';

// Use a public, CORS-friendly API (JSONPlaceholder)
interface Post {
  userId: number;
  id: number;
  title: string;
  body: string;
}

const Example = React.memo(() => {
  const { data } = useDataLoader<Post[]>('https://jsonplaceholder.typicode.com/posts')
  const res = useCallback(() => {
    console.log(`render`);
    console.log(data);
  }, [data])

  useEffect(() => {
    res()
  }, [])

  return (
    <div>
      <h1>Posts List Him</h1>
      <DataLoader<Post[]>
        url="https://jsonplaceholder.typicode.com/posts"
      >
        {(posts: Post[]) => (
          <ul>
            {posts.slice(0, 10).map((post) => (
              <li key={post.id} style={{ marginBottom: '1.5rem' }}>
                <h2>{post.title}</h2>
                <p>{post.body}</p>
                <span>Post ID: {post.id} | User ID: {post.userId}</span>
              </li>
            ))}
          </ul>
        )}
      </DataLoader>
    </div>
  );
});

export default Example;
