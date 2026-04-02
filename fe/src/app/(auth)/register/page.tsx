// src/app/(auth)/register/page.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
	IconBrandGithub,
	IconBrandGoogle,
	IconBuilding,
	IconEye,
	IconEyeOff,
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
import { type RegisterFormType, registerSchema } from "@/types/auth-types";

export default function RegisterPage() {
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<RegisterFormType>({
		resolver: zodResolver(registerSchema),
	});

	const onSubmit = async (data: RegisterFormType) => {
		setIsLoading(true);
		try {
			const response = await fetch("/api/auth/sign-up/email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: data.name,
					email: data.email,
					password: data.password,
					phone: data.phone,
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || "Failed to create account");
			}

			// Redirect to dashboard or email verification
			window.location.href = "/dashboard";
		} catch (error) {
			console.error("Registration error:", error);
			alert(error instanceof Error ? error.message : "Registration failed");
		} finally {
			setIsLoading(false);
		}
	};

	const handleSocialLogin = (provider: "google" | "github") => {
		window.location.href = `/api/auth/sign-in/${provider}`;
	};

	return (
		<Card className="md:max-w-5xl mx-auto my-12">
			<CardHeader className="text-center">
				<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
					<IconBuilding className="h-6 w-6 text-primary" />
				</div>
				<CardTitle className="text-2xl">Create an account</CardTitle>
				<CardDescription>
					Start your 14-day free trial. No credit card required.
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
						<IconBrandGoogle className="mr-2 h-4 w-4" />
						Google
					</Button>
					<Button
						variant="outline"
						onClick={() => handleSocialLogin("github")}
						disabled={isLoading}
					>
						<IconBrandGithub className="mr-2 h-4 w-4" />
						GitHub
					</Button>
				</div>

				<div className="relative">
					<div className="absolute inset-0 flex items-center">
						<span className="w-full border-t" />
					</div>
					<div className="relative flex justify-center text-xs uppercase">
						<span className="bg-card px-2 text-muted-foreground">
							Or continue with email
						</span>
					</div>
				</div>

				{/* Registration Form */}
				<form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
					<Field>
						<Label htmlFor="name">Full Name</Label>
						<Input
							id="name"
							type="text"
							placeholder="John Doe"
							{...register("name")}
							disabled={isLoading}
						/>
						{errors.name && (
							<FieldError>
							{[errors.name.message]}
							</FieldError>
						)}
					</Field>

					<Field>
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							type="email"
							placeholder="you@example.com"
							{...register("email")}
							disabled={isLoading}
						/>
						{errors.email && (
							<FieldError>{errors.email.message}</FieldError>
						)}
					</Field>

					<Field>
						<Label htmlFor="phone">Phone (optional)</Label>
						<Input
							id="phone"
							type="tel"
							placeholder="+91 98765 43210"
							{...register("phone")}
							disabled={isLoading}
						/>
						{errors.phone && (
							<FieldError>{errors.phone.message}</FieldError>
						)}
					</Field>

					<Field>
						<Label htmlFor="password">Password</Label>
						<div className="relative">
							<Input
								id="password"
								type={showPassword ? "text" : "password"}
								placeholder="Create a strong password"
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
						{/* Password Requirements Hint */}
						<p className="text-xs text-muted-foreground">
							Must be 8+ characters with uppercase, lowercase, and number
						</p>
						{errors.password && (
							<FieldError>{errors.password.message}</FieldError>
						)}
					</Field>

					<Field>
						<Label htmlFor="confirmPassword">Confirm Password</Label>
						<div className="relative">
							<Input
								id="confirmPassword"
								type={showConfirmPassword ? "text" : "password"}
								placeholder="Confirm your password"
								{...register("confirmPassword")}
								disabled={isLoading}
								className="pr-10"
							/>
							<button
								type="button"
								onClick={() => setShowConfirmPassword(!showConfirmPassword)}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							>
								{showConfirmPassword ? (
									<IconEyeOff className="h-4 w-4" />
								) : (
									<IconEye className="h-4 w-4" />
								)}
							</button>
						</div>
						{errors.confirmPassword && (
							<FieldError>
								{errors.confirmPassword.message}
							</FieldError>
						)}
					</Field>

					<Button type="submit" className="w-full" disabled={isLoading}>
						{isLoading ? "Creating account..." : "Create account"}
					</Button>
				</form>

				{/* Terms */}
				<p className="text-center text-xs text-muted-foreground">
					By creating an account, you agree to our{" "}
					<Link href="/terms" className="text-primary hover:underline">
						Terms of Service
					</Link>{" "}
					and{" "}
					<Link href="/privacy" className="text-primary hover:underline">
						Privacy Policy
					</Link>
				</p>

				{/* Sign In Link */}
				<p className="text-center text-sm text-muted-foreground">
					Already have an account?{" "}
					<Link href="/login" className="text-primary hover:underline">
						Sign in
					</Link>
				</p>
			</CardContent>
		</Card>
	);
}
