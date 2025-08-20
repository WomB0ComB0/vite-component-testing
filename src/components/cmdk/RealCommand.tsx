import { zodResolver } from "@hookform/resolvers/zod"
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form"
import { useNavigate, useSearchParams } from "react-router-dom"
import type * as z from "zod"
import { type Search, searchSchema } from "../../schema/search"
import { Div } from '../templates';
import { CommandDialog, CommandEmpty, CommandGroup, CommandItem, CommandList } from "../ui/command"
import { Form, FormControl, FormField, FormItem } from "../ui/form"
import { Input } from "../ui/input"

export function CommandMenu() {
  const [open, setOpen] = React.useState(false)
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get('q') || '');

  const defaultValues: Search = {
    search: searchParams.get('q') || '',
  }

  const form = useForm<z.infer<typeof searchSchema>>({
    resolver: zodResolver(searchSchema), defaultValues
  })


  const handleSearchBlur = () => {
    setSearchParams({}, { replace: true });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement> | any) => {
    const newValue = event.target.value;
    setSearchValue(newValue);
    setSearchParams({ q: newValue }, { replace: true });
  };



  const onSubmit = (values: z.infer<typeof searchSchema>) => {
    console.log(values)
  };

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      Object.entries(routeShortcuts).forEach(([route, shortcut]) => {
        const key = shortcut.split('+').pop();
        if (!isNaN(Number(key)) && event.altKey && event.key === key && document.activeElement?.tagName !== 'INPUT') {
          HandleShortcutAction(route);
        }
      });
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="search"

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input autoComplete="off" placeholder="Type a command or search..." onBlur={handleSearchBlur} onChange={handleSearchChange} value={searchValue} />
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </Form>
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <SearchGroups groups={...SearchGroupsList[0]} />
      </CommandList>
    </CommandDialog>
  )
}

interface SearchGroupsListProps {
  groups: {
    heading: string;
    items: Array<string>;
  }[]
}

const SearchGroupsList: SearchGroupsListProps[] = [
  {
    groups: [
      {
        heading: 'Legal',
        items: ['Privacy', 'Terms', 'Accessibility', 'Cookies'],
      },
      {
        heading: 'Auth',
        items: ['Login', 'Signup', 'Forgot Password', 'Reset Password'],
      }
    ]
  }
];

const routeShortcuts = {
  privacy: 'Alt+1',
  terms: 'Alt+2',
  accessibility: 'Alt+3',
  cookies: 'Alt+4',
  auth: {
    login: 'Alt+5',
    signup: 'Alt+6',
    forgotPassword: 'Alt+7',
    resetPassword: 'Alt+8',
  }
};

const camelToKebab = (str: string) => {
  return str.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
};

const HandleShortcutAction = (route: string) => {
  const navigate = useNavigate();
  const kebabRoute = camelToKebab(route);
  if (route.includes('/auth')) {
    navigate(`/auth/${kebabRoute}`)
  } else {
    navigate(`${kebabRoute}`)
  };
};

export const SearchGroups: React.FC<SearchGroupsListProps> = ({ groups }) => {
  return (
    <>
      {groups.map((group, groupIndex) => (
        <CommandGroup key={groupIndex} heading={group.heading}>
          {group.items.map((item, itemIndex) => (
            <Item key={itemIndex} shortcut={`Alt+${groupIndex + 1}`} onSelect={() => HandleShortcutAction(item.toLowerCase())}>
              {item}
            </Item>
          ))}
        </CommandGroup>
      ))}
    </>
  );
};

function Item({
  children,
  shortcut,
  onSelect = () => { },
}: {
  children: React.ReactNode
  shortcut?: string
  onSelect?: (value: string) => void
}) {
  return (
    <CommandItem onSelect={onSelect}>
      <span className={``}>{children}</span>
      {shortcut && (
        <Div className={``} framer={true}>
          {shortcut.split(' ').map((key, index) => (
            <kbd key={index}>{key}</kbd>
          ))}
        </Div>
      )}
    </CommandItem>
  )
}
