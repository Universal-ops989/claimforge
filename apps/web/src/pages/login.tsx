import { isApiError } from "@claimforge/api-client";
import { useLogin } from "@claimforge/api-client/react";
import { Button, Card, CardBody, CardHeader, Stack, Text } from "@claimforge/ui";
import { FormInput } from "@claimforge/ui/form";
import { FormProvider, useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";

import { PageTitle } from "../app/page-title";
import { safeNextPath } from "../auth/next-path";
import { signInErrorMessage } from "../auth/sign-in-error";

interface Credentials {
  email: string;
  password: string;
}

/** Outside the signed-in layout: no navigation until someone signs in. */
export function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const login = useLogin();
  const form = useForm<Credentials>({ defaultValues: { email: "", password: "" } });

  const signIn = form.handleSubmit(async (credentials) => {
    try {
      await login.mutateAsync(credentials);
    } catch (error) {
      // The API's field errors (422) go next to their fields; the rest above the form.
      if (isApiError(error, "validation_failed")) {
        for (const { loc, message } of error.fieldErrors) {
          const field = loc[1];
          if (field === "email" || field === "password") {
            form.setError(field, { message });
          }
        }
      }
      return;
    }
    await navigate(safeNextPath(params.get("next")), { replace: true });
  });

  const failure =
    login.error && !isApiError(login.error, "validation_failed")
      ? signInErrorMessage(login.error)
      : null;

  return (
    <Stack
      as="main"
      align="center"
      justify="center"
      style={{ minHeight: "100dvh", padding: "var(--cf-space-4)" }}
    >
      <PageTitle title="Sign in" />
      <Card variant="elevated" padding="lg" style={{ width: "min(100%, 26rem)" }}>
        <CardHeader
          headingLevel={1}
          title="Sign in to ClaimForge"
          description="Claims, field documentation and estimates in one place."
        />
        <CardBody>
          <FormProvider {...form}>
            <form
              noValidate
              aria-label="Sign in"
              onSubmit={(event) => {
                void signIn(event);
              }}
            >
              <Stack gap={4}>
                {failure && (
                  <Text as="p" role="alert" tone="danger">
                    {failure}
                  </Text>
                )}
                <FormInput<Credentials>
                  name="email"
                  label="Email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  // The first thing anyone does here is type their email.
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  required
                  registerOptions={{ required: "Enter your email address." }}
                />
                <FormInput<Credentials>
                  name="password"
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  required
                  registerOptions={{ required: "Enter your password." }}
                />
                <Button type="submit" variant="primary" fullWidth loading={login.isPending}>
                  Sign in
                </Button>
              </Stack>
            </form>
          </FormProvider>
        </CardBody>
      </Card>
    </Stack>
  );
}
