/* eslint-disable @typescript-eslint/no-unused-vars */
import './styles/globals.scss'
import './styles/cmdk/vercel.scss'


import {
  Link as NextUiLink,
  LinkProps,
} from "@nextui-org/react";
export const Link = (props: LinkProps) => <NextUiLink {...props} onClick={(e) => e.preventDefault()} />;


import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenuToggle,
  NavbarMenu,
  NavbarMenuItem
} from "@nextui-org/react";
import { SearchBar } from "./components/HardCoded";
import { useEffect, useState } from "react";
import TicTacToe from './components/tic-tac-toe/TicTacToe';
import React from 'react';

import { Card, CardContent } from './components/ui/card';
import { ParticlesContainer } from './components/particles/ParticlesContainer';

import { Button } from './components/ui/button';
import { CommandMenu } from './components/cmdk/RealCommand';
import TypeSafeApi from './components/typeSafeApi';

export default function App() {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean | undefined>(false);

  const menuItems = [
    "Profile",
    "Dashboard",
    "Activity",
    "Analytics",
    "System",
    "Deployments",
    "My Settings",
    "Team Settings",
    "Help & Feedback",
    "Log Out",
  ];
  const [appear, setAppear] = useState<boolean>(false);
  
  return (
    <>

      <main className={`flex flex-col items-center justify-center h-screen w-full`}>
        {/* <Nav /> */}
        {/* <CommandMenu /> */}
        {/* <TicTacToe /> */}
        {/* <TypeSafeApi /> */}
        {/* <Card
          className={`
            grid grid-cols-3 grid-rows-3
            gap-2 rounded-lg h-fit w-fit p-2
          `}
        >
          {[0, 1, 2].map((row) => (
            <React.Fragment key={row}>
              {[0, 1, 2].map((col) => (
                <CardContent
                  key={col}
                  className={`
                bg-[#dedede] rounded-md
                flex flex-col justify-center items-center size-28 
                `}
                />
              ))}
            </React.Fragment>
          ))}
        </Card> */}
      </main>
    </>
  );
  function Nav() {
    return (<Navbar onMenuOpenChange={setIsMenuOpen} className={`top-0 w-screen absolute flex flex-row justify-around items-center`}>
      <NavbarContent className="sm:hidden" justify="start">
        <NavbarMenuToggle aria-label={isMenuOpen ? "Close menu" : "Open menu"} />
      </NavbarContent>

      <NavbarContent className="pr-3 sm:hidden" justify="center">
        <NavbarBrand>
          <AcmeLogo />
          <p className="font-bold text-inherit">ACME</p>
        </NavbarBrand>
      </NavbarContent>

      <NavbarContent className="hidden gap-4 sm:flex" justify="center">
        <NavbarBrand>
          <AcmeLogo />
          <p className="font-bold text-inherit">ACME</p>
        </NavbarBrand>
        <NavbarItem>
          <Link color="foreground" href="#">
            Features
          </Link>
        </NavbarItem>
        <NavbarItem isActive>
          <Link href="#" aria-current="page">
            Customers
          </Link>
        </NavbarItem>
        <NavbarItem>
          <Link color="foreground" href="#">
            Integrations
          </Link>
        </NavbarItem>
      </NavbarContent>

      <NavbarContent justify="end">
        <NavbarItem className="hidden lg:flex">
          <Link href="#">Login</Link>
        </NavbarItem>
        <NavbarItem>
          <Button color="warning" variant={`default`}>
            <SearchBar />
          </Button>
        </NavbarItem>
      </NavbarContent>


      <NavbarMenu>
        {menuItems.map((item, index) => (
          <NavbarMenuItem key={`${item}-${index}`}>
            <Link
              className="w-full"
              color={index === 2 ? "primary" : index === menuItems.length - 1 ? "danger" : "foreground"}
              href="#"
              size="lg"
            >
              {item}
            </Link>
          </NavbarMenuItem>
        ))}
      </NavbarMenu>
    </Navbar>);
  }
}

const AcmeLogo = (): JSX.Element => {
  return (
    <svg fill="none" height="36" viewBox="0 0 32 32" width="36">
      <path
        clipRule="evenodd"
        d="M17.6482 10.1305L15.8785 7.02583L7.02979 22.5499H10.5278L17.6482 10.1305ZM19.8798 14.0457L18.11 17.1983L19.394 19.4511H16.8453L15.1056 22.5499H24.7272L19.8798 14.0457Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  )
};