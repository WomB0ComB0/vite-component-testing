/* eslint-disable no-case-declarations */
import React, { useState, useEffect, useCallback } from "react";
import styled from "styled-components";
import {
  PLAYER_X,
  PLAYER_O,
  DRAW,
  GAME_STATES,
  DIMENSIONS,
  GAME_MODES,
} from "../../constants/constants";
import Board from "./Board";
import { getRandomInt, switchPlayer } from "../../util/utils";
import { minimax } from "../../util/minimax";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ParticlesContainer } from "../particles/ParticlesContainer";

const arr = new Array(DIMENSIONS ** 2).fill(null);
const board = new Board();

interface Props {
  squares?: Array<number | null>;
}
const TicTacToe = ({ squares = arr }: Props) => {
  const [players, setPlayers] = useState<Record<string, number | null>>({
    human: null,
    ai: null,
  });
  const [gameState, setGameState] = useState(GAME_STATES.notStarted);
  const [grid, setGrid] = useState(squares);
  const [winner, setWinner] = useState<string | null>(null);
  const [nextMove, setNextMove] = useState<null | number>(null);
  const [mode, setMode] = useState(GAME_MODES.medium);
  const [appear, setAppear] = useState<boolean>(false);

  /**
   * On every move, check if there is a winner. If yes, set game state to over and open result modal
  */
  useEffect(() => {
    const boardWinner = board.getWinner(grid);

    const declareWinner = (winner: number) => {
      let winnerStr: string;
      switch (winner) {
        case PLAYER_X:
          winnerStr = "Player X wins!";
          break;
        case PLAYER_O:
          winnerStr = "Player O wins!";
          break;
        case DRAW:
        default:
          winnerStr = "It's a draw";
      }
      setGameState(GAME_STATES.over);
      setWinner(winnerStr);
      // Slight delay for the modal so there is some time to see the last move
    };

    if (boardWinner !== null && gameState !== GAME_STATES.over) {
      declareWinner(boardWinner);
      if (boardWinner === players.human) {
        setAppear(true);
      }
    }
  }, [gameState, grid, nextMove, players.human]);

  /**
   * Set the grid square with respective player that made the move. Only make a move when the game is in progress.
   * useCallback is necessary to prevent unnecessary recreation of the function, unless gameState changes, since it is
   * being tracked in useEffect
   * @type {Function}
  */
  const move = useCallback(
    (index: number, player: number | null) => {
      if (player !== null && gameState === GAME_STATES.inProgress) {
        setGrid((grid) => {
          const gridCopy = grid.concat();
          gridCopy[index] = player;
          return gridCopy;
        });
      }
    },
    [gameState]
  );

  /**
   * Make the AI move. If it's the first move (board is empty),
   * make move at any random cell to skip unnecessary minimax calculations
  */
  const aiMove = useCallback(() => {
    // Important to pass a copy of the grid here
    const board = new Board(grid.concat());
    const emptyIndices = board.getEmptySquares(grid);
    let index;
    switch (mode) {
      case GAME_MODES.easy:
        do {
          index = getRandomInt(0, 8);
        } while (!emptyIndices.includes(index));
        break;
      // Medium level is basically ~half of the moves are minimax and the other ~half random
      case GAME_MODES.medium:
        const smartMove = !board.isEmpty(grid) && Math.random() < 0.5;
        if (smartMove) {
          index = minimax(board, players.ai!)[1];
        } else {
          do {
            index = getRandomInt(0, 8);
          } while (!emptyIndices.includes(index));
        }
        break;
      case GAME_MODES.difficult:
      default:
        index = board.isEmpty(grid)
          ? getRandomInt(0, 8)
          : minimax(board, players.ai!)[1];
    }

    if (index !== null && !grid[index]) {
      if (players.ai !== null) {
        move(index, players.ai);
      }
      setNextMove(players.human);
    }
  }, [move, grid, players, mode]);

  /**
   * Make AI move when it's AI's turn
  */
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (
      nextMove !== null &&
      nextMove === players.ai &&
      gameState !== GAME_STATES.over
    ) {
      // Delay AI moves to make them more natural
      timeout = setTimeout(() => {
        aiMove();
      }, 500);
    }
    return () => timeout && clearTimeout(timeout);
  }, [nextMove, aiMove, players.ai, gameState]);

  const humanMove = (index: number) => {
    if (!grid[index] && nextMove === players.human) {
      move(index, players.human);
      setNextMove(players.ai);
    }
  };

  const choosePlayer = (option: number) => {
    setPlayers({ human: option, ai: switchPlayer(option) });
    setGameState(GAME_STATES.inProgress);
    setNextMove(PLAYER_X);
  };

  const startNewGame = () => {
    setGameState(GAME_STATES.notStarted);
    setGrid(arr);
    setAppear(false);
  };

  const changeMode = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setMode(e.target.value);
  };

  return gameState === GAME_STATES.notStarted ? (
    <Card
      className={`
                        border-none shadow-none
                        p-2 bg-transparent not-sr-only 
                        `}
    >
      <CardContent
        className={`
        flex flex-row items-center justify-between w-full h-fit gap-4
        `}
      >
        <article
          role={`button`}
          onClick={() => choosePlayer(PLAYER_X)}
          className={`
          bg-[#dedede] rounded-lg items-center text-center justify-center flex size-fit p-2 hover:bg-[#bebebe]
          hover:shadow-lg transition-all duration-300 ease-in-out
          `}
        >
          <span
            className={`text-[55px]`}
          >
            ✖️
          </span>
        </article>
        <p
          className={`text-[24px] font-bold text-uppercase select-none`}
        >
          {"or"}
        </p>
        <article
          role={`button`}
          onClick={() => choosePlayer(PLAYER_O)}
          className={`
          bg-[#dedede] rounded-lg items-center text-center justify-center flex size-fit p-2 hover:bg-[#bebebe]
          hover:shadow-lg transition-all duration-300 ease-in-out
          `}
        >
          <span
            className={`text-[55px]`}
          >
            ⭕
          </span>
        </article>
      </CardContent>
      <CardFooter>
        <Select>
          <SelectTrigger>
            <SelectValue
              onChange={changeMode} placeholder={`Select difficulty`}
            />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(GAME_MODES).map((key) => {
              const gameMode = GAME_MODES[key];
              return (
                <SelectItem key={gameMode} value={gameMode}>
                  {key}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </CardFooter>
    </Card>
  ) : (
    <>
      {(gameState === GAME_STATES.over) && (
        <>
          {
            appear && (
              <ParticlesContainer />
            )
          }
          {/* Disappear after 5 seconds */}
          <Card
            style={{
              zIndex: 1000,
              translate: "translate(-50%, -50%)",
            }}
              className={` bg-white fixed left-[50%] top-[50%] z-50 grid w-md translate-x-[-50%] translate-y-[-50%] backface-hidden p-[0.25rem] rounded-md border-[0.5px] border-[#41403e]/20`}
          >
            <CardHeader
              className={`text-center`}
            >
              <CardTitle>
                {"Game over"}
              </CardTitle>
              <CardDescription>
                {`🎉 ${winner} 🎉`}
              </CardDescription>
            </CardHeader>
          </Card>
        </>
      )}
      <section
        className={`
        flex flex-col items-center justify-center gap-4
        `}
      >
        <h3
          className={`text-[24px] font-bold text-uppercase select-none`}
        >
          {players.human === PLAYER_X
            ? "You are playing as ✖️"
            : "You are playing as ⭕"}
        </h3>
        <Container
          className={`grid grid-cols-3 grid-rows-3
        gap-2 rounded-lg h-fit w-fit p-2 shadow-lg`}
          dims={DIMENSIONS}
        >
          {grid.map((value, index) => {
            const isActive = value !== null;

            return (
              <Square
                className={
                  `bg-[#dedede] rounded-md
              flex flex-col justify-center items-center size-28 hover:bg-[#bebebe] hover:shadow-lg transition-all duration-300 ease-in-out`
                }
                data-testid={`square_${index}`}
                key={index}
                onClick={() => humanMove(index)}
              >
                {isActive && <Marker>{value === PLAYER_X ? "✖️" : "⭕"}</Marker>}
              </Square>
            );
          })}
        </Container>
        <Button
          className={`text-[16px]`}
          onClick={startNewGame}
          content="Start over"
        >
          {"Start over"}
        </Button>
      </section>
    </>
  );
};

const Container = styled.article<{ dims: number }>`
background-color: white;
`;

const Square = styled.div`
&:hover {
  cursor: pointer;
}
`;

Square.displayName = "Square";

const Marker = styled.p`
  font-size: 68px;
  `;

export default TicTacToe;