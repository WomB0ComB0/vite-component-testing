import React, { useEffect, useState } from "react";
import { getUser } from "@/api/typeSafeApi";

const TypeSafeApi = () => {
	const [userName, setUserName] = useState<string | null>(null);

	useEffect(() => {
		// Fetch user data when the component mounts
		getUser({ id: "0" })
			.then((user) => {
				// Set the user name in the component state
				setUserName(user.name);
			})
			.catch((error) => {
				// Handle errors if needed
				console.error("Error fetching user:", error);
			});
	}, []);

	return (
		<div>
			<h1>User Name: {userName}</h1>
		</div>
	);
};

export default TypeSafeApi;
