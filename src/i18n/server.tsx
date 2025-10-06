import { IntlMessageFormat } from "intl-messageformat";
import { env } from "@/env.mjs";
import type { IntlNamespaceKeys, NamespacedKeys } from "./types";

type MessagesShape = typeof import("../../messages/en-US.json");
type MessageModule = Promise<{ default: MessagesShape }>;

const createMessageLoader = (loader: () => Promise<{ default: unknown }>) => loader as () => MessageModule;

const MESSAGE_LOADERS = {
	"en-US": createMessageLoader(() => import("../../messages/en-US.json")),
	"de-DE": createMessageLoader(() => import("../../messages/de-DE.json")),
	"fr-CA": createMessageLoader(() => import("../../messages/fr-CA.json")),
	"jp-JP": createMessageLoader(() => import("../../messages/jp-JP.json")),
	"zh-CN": createMessageLoader(() => import("../../messages/zh-CN.json")),
	"zh-TW": createMessageLoader(() => import("../../messages/zh-TW.json")),
} satisfies Record<string, () => MessageModule>;

type AvailableLocale = keyof typeof MESSAGE_LOADERS;
const FALLBACK_LOCALE: AvailableLocale = "en-US";

const resolveLocale = (value: string | undefined): AvailableLocale => {
	if (value && value in MESSAGE_LOADERS) {
		return value as AvailableLocale;
	}
	if (value) {
		const lower = value.toLowerCase();
		const match = (Object.keys(MESSAGE_LOADERS) as AvailableLocale[]).find(
			(locale) => locale.toLowerCase() === lower,
		);
		if (match) return match;
	}
	return FALLBACK_LOCALE;
};

export const getLocale = async (): Promise<AvailableLocale> => resolveLocale(env.NEXT_PUBLIC_LANGUAGE);

export const getMessages = async () => {
	const locale = await getLocale();
	const { default: messages } = await MESSAGE_LOADERS[locale]();
	return messages;
};

export const getTranslations = async <TNamespaceKey extends IntlNamespaceKeys = never>(
	namespaceKey: TNamespaceKey,
) => {
	const messages = await getMessages();
	const locale = await getLocale();
	return getMessagesInternal(namespaceKey, locale, messages);
};

export const getMessagesInternal = <TNamespaceKey extends IntlNamespaceKeys = never>(
	namespaceKey: TNamespaceKey,
	locale: string,
	messages: IntlMessages,
) => {
	return <TMessageKey extends NamespacedKeys<IntlMessages, TNamespaceKey> = never>(
		key: TMessageKey,
		values?: Record<string, string | number | undefined>,
	) => {
		const completeKey = namespaceKey + "." + key;
		const msg = messages[completeKey as keyof typeof messages];
		const message = new IntlMessageFormat(msg, locale).format(values)?.toString() ?? "";
		return message;
	};
};
