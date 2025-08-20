import React, { useEffect, useState } from "react";
import { fetchData } from "./api/typeSafeFetch";

const get = async (url: string, input: Record<string, string>) => {
	return fetchData<User[]>(`${url}?${new URLSearchParams(input).toString()}`);
};

const put = async (url: string, input: Record<string, string>) => {
	return fetch(url, {
		method: "PUT",
		body: JSON.stringify(input),
	});
};

const patch = async (url: string, input: Record<string, string>) => {
	return fetch(url, {
		method: "PATCH",
		body: JSON.stringify(input),
	});
};

const del = async (url: string) => {
	return fetch(url, {
		method: "DELETE",
	});
};

const post = async (url: string, input: Record<string, string>) => {
	return fetch(url, {
		method: "POST",
		body: JSON.stringify(input),
	});
};

type Address = {
	address: string;
	city: string;
	coordinates: {
		lat: number;
		lng: number;
	};
	postalCode: string;
	state: string;
};

type Hair = {
	color: string;
	type: string;
};

type Bank = {
	cardExpire: string;
	cardNumber: string;
	cardType: string;
	currency: string;
	iban: string;
};

type Company = {
	address: Address;
	department: string;
	name: string;
	title: string;
};

type Crypto = {
	coin: string;
	wallet: string;
	network: string;
};

type User = {
	id: number;
	firstName: string;
	lastName: string;
	age: number;
	gender: string;
	email: string;
	phone: string;
	username: string;
	birthDate: string;
	image: string;
	bloodGroup: string;
	height: number;
	weight: number;
	eyeColor: string;
	hair: Hair;
	domain: string;
	ip: string;
	address: Address;
	macAddress: string;
	university: string;
	bank: Bank;
	company: Company;
	ein: string;
	ssn: string;
	userAgent: string;
	crypto: Crypto;
};

type CreateAPIMethod = <TInput extends Record<string, string>, TOutput>(opts: {
	url: string;
	method: "GET" | "POST";
}) => (input: TInput) => Promise<TOutput>;

const createAPIMethod: CreateAPIMethod = (opts) => (input) => {
	const method = opts.method === "GET" ? get : post;

	return method(opts.url, input).then((res) => res.json());
};

const getUsers = createAPIMethod<{ page: string }, { users: User[] }>({
	method: "GET",
	url: "https://dummyjson.com/users",
});

const UserListComponent = () => {
	const [users, setUsers] = useState<User[]>([]);
	useEffect(() => {
		getUsers({ page: "1" })
			.then((data) => {
				setUsers(data.users);
			})
			.catch((error) => {
				console.error("Error fetching users:", error);
			});
	}, []);

	return (
		<div>
			<h1>User List</h1>
			<ul>
				{users.slice(0, 10).map((user) => (
					<li key={user.id}>
						{user.firstName} {user.lastName} - Age: {user.age}, Email:{" "}
						{user.email}
					</li>
				))}
			</ul>
		</div>
	);
};

export default UserListComponent;
