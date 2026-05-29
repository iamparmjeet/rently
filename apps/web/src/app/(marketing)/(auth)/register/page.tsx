// src/app/(auth)/register/page.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@rently/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import { Field, FieldError } from "@rently/ui/components/field";
import { Input } from "@rently/ui/components/input";
import { Label } from "@rently/ui/components/label";
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
import { useRegister, useSocialLogin } from "@/hooks/auth";
import { type RegisterFormType, registerSchema } from "@/types/auth-types";

export default function RegisterPage() {
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const { onSubmit, isLoading } = useRegister();

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<RegisterFormType>({
		resolver: zodResolver(registerSchema),
	});
	const { handleSocialLogin, loadingProvider } = useSocialLogin();

	return (
		<Card className="mx-auto my-12 md:max-w-5xl">
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
						disabled={!!loadingProvider}
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
						disabled={!!loadingProvider}
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
						{errors.name && <FieldError>{errors.name.message}</FieldError>}
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
						{errors.email && <FieldError>{errors.email.message}</FieldError>}
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
						{errors.phone && <FieldError>{errors.phone.message}</FieldError>}
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
								className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							>
								{showPassword ? (
									<IconEyeOff className="h-4 w-4" />
								) : (
									<IconEye className="h-4 w-4" />
								)}
							</button>
						</div>
						{/* Password Requirements Hint */}
						<p className="text-muted-foreground text-xs">
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
								className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							>
								{showConfirmPassword ? (
									<IconEyeOff className="h-4 w-4" />
								) : (
									<IconEye className="h-4 w-4" />
								)}
							</button>
						</div>
						{errors.confirmPassword && (
							<FieldError>{errors.confirmPassword.message}</FieldError>
						)}
					</Field>

					<Button type="submit" className="w-full" disabled={isLoading}>
						{isLoading ? "Creating account..." : "Create account"}
					</Button>
				</form>

				{/* Terms */}
				<p className="text-center text-muted-foreground text-xs">
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
				<p className="text-center text-muted-foreground text-sm">
					Already have an account?{" "}
					<Link href="/login" className="text-primary hover:underline">
						Sign in
					</Link>
				</p>
			</CardContent>
		</Card>
	);
}
