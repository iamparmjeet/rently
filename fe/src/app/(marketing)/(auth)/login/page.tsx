// src/app/(auth)/login/page.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
	IconBrandGithub,
	IconBrandGoogle,
	IconBuilding,
	IconEye,
	IconEyeOff,
	IconLoader2,
} from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin, useSocialLogin } from "@/hooks/auth";
import { type LoginFormType, loginSchema } from "@/types/auth-types";

export default function LoginPage() {
	const [showPassword, setShowPassword] = useState(false);
	const { onSubmit, isLoading } = useLogin();
	const { handleSocialLogin, loadingProvider } = useSocialLogin();

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<LoginFormType>({
		resolver: zodResolver(loginSchema),
	});

	return (
		<Card className="md:max-w-5xl md:min-w-md mx-auto my-12">
			<CardHeader className="text-center">
				<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
					<IconBuilding className="h-6 w-6 text-primary" />
				</div>
				<CardTitle className="text-2xl">Welcome back</CardTitle>
				<CardDescription>
					Sign in to your RentWise account to continue
				</CardDescription>
			</CardHeader>

			<CardContent className="grid gap-4">
				{/* Social Login Buttons */}
				<div className="grid grid-cols-2 gap-4">
					<Button
						variant="outline"
						onClick={() => handleSocialLogin("google")}
						disabled={isLoading}
					>
						{loadingProvider === "google" ? (
							<>
								<IconLoader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
								Connecting...
							</>
						) : (
							<>
								<IconBrandGoogle className="mr-2 h-4 w-4" /> Google
							</>
						)}
					</Button>
					<Button
						variant="outline"
						onClick={() => handleSocialLogin("github")}
						disabled={isLoading}
					>
						{loadingProvider === "github" ? (
							<>
								<IconLoader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
								Connecting...
							</>
						) : (
							<>
								<IconBrandGithub className="mr-2 h-4 w-4" /> GitHub
							</>
						)}
					</Button>
				</div>

				<div className="relative">
					<div className="absolute inset-0 flex items-center">
						<span className="w-full border-t" />
					</div>
					<div className="relative flex justify-center text-xs uppercase">
						<span className="bg-card px-2 text-muted-foreground">
							Or continue with
						</span>
					</div>
				</div>

				{/* Email/Password Form */}
				<form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
					<Field>
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							type="email"
							placeholder="you@example.com"
							{...register("email")}
							disabled={isLoading}
						/>
						{errors.email && <FieldError>{errors.email.message}</FieldError>}
					</Field>

					<Field>
						<div className="flex items-center justify-between">
							<Label htmlFor="password">Password</Label>
							<Link
								href="/forgot-password"
								className="text-xs text-primary hover:underline"
							>
								Forgot password?
							</Link>
						</div>
						<div className="relative">
							<Input
								id="password"
								type={showPassword ? "text" : "password"}
								placeholder="Enter your password"
								{...register("password")}
								disabled={isLoading}
								className="pr-10"
							/>
							<button
								type="button"
								onClick={() => setShowPassword(!showPassword)}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							>
								{showPassword ? (
									<IconEyeOff className="h-4 w-4" />
								) : (
									<IconEye className="h-4 w-4" />
								)}
							</button>
						</div>
						{errors.password && (
							<FieldError>{errors.password.message}</FieldError>
						)}
					</Field>

					<Button type="submit" className="w-full" disabled={isLoading}>
						{isLoading ? "Signing in..." : "Sign in"}
					</Button>
				</form>

				{/* Sign Up Link */}
				<p className="text-center text-sm text-muted-foreground">
					Don&apos;t have an account?{" "}
					<Link href="/register" className="text-primary hover:underline">
						Sign up
					</Link>
				</p>
			</CardContent>
		</Card>
	);
}
