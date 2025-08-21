import { NextUIProvider } from "@nextui-org/react";
// import TypeSafeApi from './components/typeSafeApi.tsx';
// import UserListComponent from './UserListComponent.tsx';
// import Example from './example.tsx';
import { QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
// import { CmdKConfigurer } from "@cmdk/react-ui-toolkit"
// import App from "./App.tsx";
import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import NotFound from "./components/dom/404";
import { Toaster } from "./components/ui/toaster";
import { createQueryClient } from "./query-client.ts";
import SecureImageUpload from "./upload.tsx";
import "./tailwind.css";
import Example from "./example.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<QueryClientProvider client={createQueryClient()}>
			<NextUIProvider>
				<Toaster />
				<Router>
					<Routes>
						<Route
							path="/"
							element={
								<SecureImageUpload
									onUpload={async (images) => {
										for (const img of images) {
											const fd = new FormData();
											fd.append('file', img.file, img.file.name);

											const res = await fetch('http://localhost:3000/api/reverse-image', {
												method: 'POST',
												body: fd,
											});

											if (!res.ok) {
												const err = await res.json().catch(() => ({}));
												console.error('Vision error', err);
												continue;
											}

											const { data } = await res.json();
											console.log('Web Detection for', img.file.name, data);

											// TODO: pipe `data` into your UI:
											// - List `pagesWithMatchingImages`
											// - Show `fullMatchingImages` thumbnails
											// - Use `webEntities` as tags/labels
										}
									}}
								/>}
						/>
						<Route path="*" element={<NotFound />} />
					</Routes>
				</Router>
			</NextUIProvider>
		</QueryClientProvider>
	</React.StrictMode>,
);
