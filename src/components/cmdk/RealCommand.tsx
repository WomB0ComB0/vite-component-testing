import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "../ui/command"
import React, { useState } from "react"
import { Form, FormControl, FormField, FormItem } from "../ui/form"
import { useForm } from "react-hook-form"
import { Search, searchSchema } from "../search"
import * as z from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useSearchParams } from "react-router-dom"
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

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name="search"
            
            render={({field}) => (
              <FormItem>
                <FormControl>
                  <Input autoComplete="off" placeholder="Type a command or search..." onBlur={handleSearchBlur} onChange={handleSearchChange} value={searchValue}/>
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </Form>
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          <CommandItem>Calendar</CommandItem>
          <CommandItem>Search Emoji</CommandItem>
          <CommandItem>Calculator</CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}