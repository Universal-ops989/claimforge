import { isApiError, type Schema } from "@claimforge/api-client";
import {
  allItems,
  useContacts,
  useCreateContact,
  useLinkContact,
  useUnlinkContact,
  useUpdateContactLink,
} from "@claimforge/api-client/react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  EmptyState,
  FormField,
  Inline,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Select,
  SkeletonText,
  Stack,
  Text,
} from "@claimforge/ui";
import { MoreHorizontal } from "lucide-react";
import { useDeferredValue, useId, useState } from "react";

import { useOrganization } from "../../app/organization";
import { errorCopy } from "../../app/states";
import { displayPhone, telLink } from "../../format/phone";
import {
  CONTACT_ROLE_LABEL,
  CONTACT_ROLES,
  kindFor,
  PREFERS,
  roleFor,
  type ContactRole,
} from "../contacts";
import type { Claim } from "./tabs";

type Contact = Schema<"ContactRead">;
type Link = Schema<"ClaimContactRead">;

/**
 * Who to reach about the claim, and how; with `canChange`, adding, making primary and
 * removing contacts too.
 */
export function ContactsCard({ claim, canChange }: { claim: Claim; canChange: boolean }) {
  const [adding, setAdding] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // The primary contact first: the one to call.
  const links = [...claim.contacts].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));

  return (
    <Card role="region" aria-label="Contacts">
      <CardHeader
        headingLevel={2}
        title="Contacts"
        actions={
          canChange && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFailure(null);
                setAdding(true);
              }}
            >
              Add contact
            </Button>
          )
        }
      />
      <CardBody>
        <Stack gap={3}>
          {failure && (
            <Text as="p" role="alert" tone="danger">
              {failure}
            </Text>
          )}
          {links.length === 0 ? (
            <EmptyState
              size="compact"
              headingLevel={3}
              title="No contacts yet"
              description="Add the insured, and anyone else to reach about this claim."
            />
          ) : (
            <Stack
              as="ul"
              gap={4}
              aria-label="Contacts"
              style={{ listStyle: "none", margin: 0, padding: 0 }}
            >
              {links.map((link) => (
                <li key={link.contact.id}>
                  <ContactRow
                    claim={claim}
                    link={link}
                    canChange={canChange}
                    onFailure={setFailure}
                  />
                </li>
              ))}
            </Stack>
          )}
        </Stack>
      </CardBody>
      <Dialog open={adding} onOpenChange={setAdding}>
        {adding && (
          <AddContactForm
            claim={claim}
            onDone={() => {
              setAdding(false);
            }}
          />
        )}
      </Dialog>
    </Card>
  );
}

function ContactRow({
  claim,
  link,
  canChange,
  onFailure,
}: {
  claim: Claim;
  link: Link;
  canChange: boolean;
  onFailure: (message: string | null) => void;
}) {
  const organization = useOrganization();
  const update = useUpdateContactLink(organization.id, claim.id);
  const unlink = useUnlinkContact(organization.id, claim.id);
  const { contact } = link;
  const name = contact.full_name;

  return (
    <Inline justify="between" align="start" gap={3}>
      <Stack gap={1}>
        <Inline gap={2} align="center">
          <Text>{name}</Text>
          {link.is_primary && (
            <Badge tone="accent" size="sm">
              Primary
            </Badge>
          )}
        </Inline>
        <Text size="sm" tone="muted">
          {[CONTACT_ROLE_LABEL[link.role], contact.company_name].filter(Boolean).join(" · ")}
        </Text>
        <Inline gap={3}>
          {contact.phone && (
            <Text size="sm">
              <a href={telLink(contact.phone)}>{displayPhone(contact.phone)}</a>
            </Text>
          )}
          {contact.email && (
            <Text size="sm" style={{ overflowWrap: "anywhere" }}>
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </Text>
          )}
        </Inline>
        {contact.preferred_contact_method && (
          <Text size="sm" tone="subtle">
            {PREFERS[contact.preferred_contact_method]}
          </Text>
        )}
      </Stack>
      {canChange && (
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label={`Change ${name} on this claim`}>
              <MoreHorizontal size={16} aria-hidden="true" />
            </Button>
          </MenuTrigger>
          <MenuContent>
            {!link.is_primary && (
              <MenuItem
                onSelect={() => {
                  onFailure(null);
                  update.mutate(
                    { contactId: contact.id, is_primary: true },
                    {
                      onError: (error) => {
                        onFailure(`${name} isn't the primary contact. ${message(error)}`);
                      },
                    },
                  );
                }}
              >
                Make primary
              </MenuItem>
            )}
            <MenuItem
              tone="danger"
              onSelect={() => {
                onFailure(null);
                unlink.mutate(contact.id, {
                  onError: (error) => {
                    onFailure(`${name} is still on the claim. ${message(error)}`);
                  },
                });
              }}
            >
              Remove from claim
            </MenuItem>
          </MenuContent>
        </Menu>
      )}
    </Inline>
  );
}

function AddContactForm({ claim, onDone }: { claim: Claim; onDone: () => void }) {
  const organization = useOrganization();
  const link = useLinkContact(organization.id, claim.id);
  const create = useCreateContact(organization.id);
  const canFile = organization.permissions.includes("contacts:write");
  const formId = useId();
  const [chosen, setChosen] = useState<Contact | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [role, setRole] = useState<ContactRole | "">("");
  // The first contact on a claim is its primary one, unless said otherwise.
  const [primary, setPrimary] = useState(claim.contacts.length === 0);
  const [missing, setMissing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const submit = async () => {
    setFailure(null);
    if ((isNew ? !newName.trim() : !chosen) || !role) {
      setMissing(true);
      return;
    }
    try {
      const contact = isNew
        ? await create.mutateAsync({
            full_name: newName.trim(),
            kind: kindFor(role),
            phone: newPhone.trim() || null,
            email: newEmail.trim() || null,
          })
        : chosen;
      if (!contact) return;
      await link.mutateAsync({ contact_id: contact.id, role, is_primary: primary });
    } catch (error) {
      setFailure(addFailure(error));
      return;
    }
    onDone();
  };

  return (
    <DialogContent
      title="Add a contact"
      description="Someone to reach about this claim, from your address book or new."
      size="md"
      footer={
        <>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            loading={create.isPending || link.isPending}
          >
            Add to claim
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        aria-label="Add a contact"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Stack gap={4}>
          {failure && (
            <Text as="p" role="alert" tone="danger">
              {failure}
            </Text>
          )}
          {isNew ? (
            <Stack gap={3}>
              <FormField
                label="Name"
                required
                error={missing && !newName.trim() ? "Enter their name." : undefined}
              >
                <Input
                  value={newName}
                  maxLength={200}
                  onChange={(event) => {
                    setNewName(event.target.value);
                  }}
                />
              </FormField>
              <FormField label="Phone">
                <Input
                  type="tel"
                  value={newPhone}
                  maxLength={40}
                  onChange={(event) => {
                    setNewPhone(event.target.value);
                  }}
                />
              </FormField>
              <FormField label="Email">
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(event) => {
                    setNewEmail(event.target.value);
                  }}
                />
              </FormField>
              <Inline>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsNew(false);
                  }}
                >
                  Choose from the address book instead
                </Button>
              </Inline>
            </Stack>
          ) : chosen ? (
            <Inline justify="between" align="center" gap={3}>
              <Stack gap={1}>
                <Text>{chosen.full_name}</Text>
                {chosen.company_name && (
                  <Text size="sm" tone="muted">
                    {chosen.company_name}
                  </Text>
                )}
              </Stack>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setChosen(null);
                }}
              >
                Choose someone else
              </Button>
            </Inline>
          ) : (
            <AddressBookSearch
              claim={claim}
              invalid={missing}
              onChoose={(contact) => {
                setChosen(contact);
                if (!role) setRole(roleFor(contact.kind));
              }}
              onNew={
                canFile
                  ? () => {
                      setIsNew(true);
                    }
                  : null
              }
            />
          )}
          <FormField
            label="Their part in the claim"
            required
            error={missing && !role ? "Choose their part." : undefined}
          >
            <Select
              placeholder="Choose one"
              options={CONTACT_ROLES.map((r) => ({ value: r, label: CONTACT_ROLE_LABEL[r] }))}
              value={role}
              onValueChange={(value) => {
                setRole(value as ContactRole);
              }}
            />
          </FormField>
          <Checkbox
            label="Primary contact"
            description="The first person to reach about this claim."
            checked={primary}
            onCheckedChange={(checked) => {
              setPrimary(checked === true);
            }}
          />
        </Stack>
      </form>
    </DialogContent>
  );
}

/** Search the address book, leaving out who's on the claim already. */
function AddressBookSearch({
  claim,
  invalid,
  onChoose,
  onNew,
}: {
  claim: Claim;
  invalid: boolean;
  onChoose: (contact: Contact) => void;
  onNew: (() => void) | null;
}) {
  const organization = useOrganization();
  const [q, setQ] = useState("");
  // Typing stays quick; the search follows.
  const search = useDeferredValue(q.trim());
  const contacts = useContacts(organization.id, search ? { q: search, limit: 10 } : { limit: 10 });
  const onClaim = new Set(claim.contacts.map((c) => c.contact.id));
  const found = allItems(contacts.data).filter((c) => !onClaim.has(c.id));

  return (
    <Stack gap={2}>
      <FormField
        label="Search the address book"
        hint="Name, company, email or phone"
        error={invalid ? "Choose someone, or add someone new." : undefined}
      >
        <Input
          type="search"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
          }}
        />
      </FormField>
      {contacts.isPending ? (
        <SkeletonText lines={3} />
      ) : contacts.isError ? (
        <Text as="p" role="alert" tone="danger">
          {message(contacts.error)}
        </Text>
      ) : found.length === 0 ? (
        <Text as="p" tone="muted">
          {search
            ? `Nobody in the address book matches "${search}".`
            : "The address book is empty."}
        </Text>
      ) : (
        <Stack
          as="ul"
          gap={1}
          aria-label="Matching contacts"
          style={{ listStyle: "none", margin: 0, padding: 0 }}
        >
          {found.map((contact) => (
            <li key={contact.id}>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Choose ${contact.full_name}`}
                onClick={() => {
                  onChoose(contact);
                }}
              >
                {[contact.full_name, contact.company_name].filter(Boolean).join(" · ")}
              </Button>
            </li>
          ))}
        </Stack>
      )}
      {onNew && (
        <Inline>
          <Button variant="secondary" size="sm" onClick={onNew}>
            Add someone new
          </Button>
        </Inline>
      )}
    </Stack>
  );
}

/** Adding refused, in words. */
function addFailure(error: unknown): string {
  if (isApiError(error, "contact_already_linked")) {
    return "They're on this claim already. Change their part from the list instead.";
  }
  if (isApiError(error, "unknown_contact")) {
    return "That contact isn't in the address book any more. Search again.";
  }
  if (isApiError(error, "validation_failed")) {
    const [first] = error.fieldErrors;
    if (first) return first.message;
  }
  return message(error);
}

function message(error: unknown): string {
  if (isApiError(error, "claim_locked")) {
    return "The claim was closed or cancelled, so its contacts can't change.";
  }
  const copy = errorCopy(error);
  return `${copy.title}. ${copy.description}`;
}
