"use client"

import React, { ReactNode, ReactElement } from "react"
import { AuthProvider } from "./Auth"
import { CompanyProvider } from "./Company"
import { AssistantsProvider } from "./Assistants"
import { AssistantSettingsProvider } from "./AssistantSettings"
import { CategoriesProvider } from "./Categories"
import { ChatsProvider } from "./Chats"
import { ProductsProvider } from "./Products"
import { MessagesProvider } from "./Messages"
import { ContactsProvider } from "./Contacts"
import { TypingProvider } from "./typing"
import { ServicesProvider } from "./Services"
import { ProfessionalsProvider } from "./Professionals"
import { SpecialtiesProvider } from "./Specialties"
import { AgreementsProvider } from "./Agreements"

type ContextProvider = React.ComponentType<{ children: ReactNode }>

const combineProviders = (
  providers: ContextProvider[],
  children: ReactNode
): ReactElement | null =>
  providers.reduceRight<ReactElement | null>(
    (child, Provider) => <Provider>{child}</Provider>,
    children as ReactElement
  )

const GlobalContext: React.FC<{ children: ReactNode }> = ({ children }) => {
  const contextProviders: ContextProvider[] = [
    AuthProvider,
    AssistantsProvider,
    CompanyProvider,
    AssistantSettingsProvider,
    CategoriesProvider,
    ProductsProvider,
    ServicesProvider,
    ChatsProvider,
    MessagesProvider,
    ContactsProvider,
    TypingProvider,
    ProfessionalsProvider,
    SpecialtiesProvider,
    AgreementsProvider,
  ]

  return combineProviders(contextProviders, children)
}

export default GlobalContext
