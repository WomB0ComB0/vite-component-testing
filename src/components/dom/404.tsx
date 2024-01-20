import { useRouteError } from 'react-router-dom';
import { Button } from '@nextui-org/react';

export default function NotFound() {
  const err = useRouteError() as RouteError;

  return (
    <>
      <main className="flex flex-col items-center justify-center w-screen h-screen">
        <section className={``}>
          <article className={``}>
            <h1 className={``}>
              <span>{err.status}</span>
              <i> - </i>
              <span>
                <>{err.name}</>
              </span>
            </h1>
            <p>
              <b>{err.statusText}</b>
            </p>
          </article>
          <menu className={`flex  justify-around`}>
            <li>
              <Button radius={`md`} color={`primary`} variant={`ghost`}>

              </Button>
            </li>
            <li>
              <Button radius={`md`} color={`primary`} variant={`ghost`}>

              </Button>
            </li>
          </menu>
        </section>
      </main>
    </>
  );
}

type RouteError = Error & { status?: number; statusText?: string };
