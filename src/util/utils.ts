import { PLAYER_O, PLAYER_X } from "../constants/constants";

export const switchPlayer = (player: number) => {
  return player === PLAYER_X ? PLAYER_O : PLAYER_X;
};

export const getRandomInt = (min: number, max: number) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};


/**
 * Parses the code path and returns a formatted string with the location and function name.
 *
 * @param {any} context - The context to include in the formatted string.
 * @param {Function} fnName - The function to include in the formatted string.
 * @returns {string} - The formatted string with the location and function name.
 */
export const parseCodePath = (context: any, fnName: Function): string =>
  `location: ${process.cwd()}${__filename} @${fnName.name}: ${context}`;

type Success<T> = {
  readonly success: true;
  readonly value: T;
};

type Failure<E> = {
  readonly success: false;
  readonly error: E;
};

type Result<T, E> = Success<T> | Failure<E>;

/**
 * Creates a successful result
 * @param value The value to wrap in a success result
 */
export const success = <T>(value: T): Success<T> =>
  Object.freeze({ success: true, value });

/**
 * Creates a failed result
 * @param error The error to wrap in a failure result
 */
export const failure = <E>(error: E): Failure<E> =>
  Object.freeze({ success: false, error });

type ExtractAsyncArgs<Args extends Array<any>> = Args extends Array<infer PotentialArgTypes> ? [PotentialArgTypes] : []

export const catchError = async <Args extends Array<any>, ReturnType>(
  asyncFunction: (...args: ExtractAsyncArgs<Args>) => Promise<ReturnType>,
  ...args: ExtractAsyncArgs<Args>
): Promise<Result<ReturnType, Error>> => {
  try {
    const result = await asyncFunction(...args);
    return success(result);
  } catch (error) {
    console.error('catchError', { error });
    return failure(error as Error);
  }
}
