"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@rently/ui/components/button";
import { CardContent } from "@rently/ui/components/card";
import { Field, FieldError } from "@rently/ui/components/field";
import { Input } from "@rently/ui/components/input";
import { Label } from "@rently/ui/components/label";
import { type RegisterFormType, registerSchema } from "@rently/validators";
import { IconEye, IconEyeOff, IconLoader2 } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRegister, useSocialLogin } from "@/hooks/auth";

export function RegisterForm() {
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
		<CardContent className="grid gap-4 px-0">
			{/* Social Login Buttons */}
			<div className="grid grid-cols-2 gap-4">
				<Button
					size="lg"
					variant="outline"
					onClick={() => handleSocialLogin("google")}
					disabled={!!loadingProvider}
				>
					{loadingProvider === "google" ? (
						<span>
							<IconLoader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
							Connecting...
						</span>
					) : (
						<GoogleButton />
					)}
				</Button>
				<Button
					size="lg"
					variant="outline"
					onClick={() => handleSocialLogin("github")}
					disabled={!!loadingProvider}
				>
					{loadingProvider === "github" ? (
						<span>
							<IconLoader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
							Connecting...
						</span>
					) : (
						<GithubButton />
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
	);
}

function GithubButton() {
	return (
		<>
			<svg viewBox="0 0 24 24" className="size-4 fill-foreground">
				<title>Github</title>
				<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
			</svg>
			GitHub
		</>
	);
}

function GoogleButton() {
	return (
		<>
			<svg className="size-4" viewBox="0 0 24 24">
				<title>Google</title>
				<path
					d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
					fill="#4285F4"
				/>
				<path
					d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
					fill="#34A853"
				/>
				<path
					d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
					fill="#FBBC05"
				/>
				<path
					d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
					fill="#EA4335"
				/>
			</svg>
			Google
		</>
	);
}
