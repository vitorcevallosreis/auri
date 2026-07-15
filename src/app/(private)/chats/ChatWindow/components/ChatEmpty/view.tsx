"use client"

import React from "react"
import useChatEmptyModel from "./model"

export default function ChatEmptyView({}: ReturnType<
  typeof useChatEmptyModel
>) {
  return (
    <div className="flex justify-center items-center h-screen">
      <div className="">
        <div className="flex justify-center -space-x-2">
          <img
            className="inline-block size-[46px] rounded-full ring-2 ring-white dark:ring-neutral-900"
            src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?ixlib=rb-4.0.3&auto=format&fit=facearea&facepad=2&w=300&h=300&q=80"
            alt="Paciente"
          />
          <img
            className="inline-block size-[46px] rounded-full ring-2 ring-white dark:ring-neutral-900"
            src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?ixlib=rb-4.0.3&auto=format&fit=facearea&facepad=2&w=300&h=300&q=80"
            alt="Paciente"
          />
          <img
            className="inline-block size-[46px] rounded-full ring-2 ring-white dark:ring-neutral-900"
            src="https://images.unsplash.com/photo-1582750433449-648ed127bb54?ixlib=rb-4.0.3&auto=format&fit=facearea&facepad=2&w=300&h=300&q=80"
            alt="Paciente"
          />
          <img
            className="inline-block size-[46px] rounded-full ring-2 ring-white dark:ring-neutral-900"
            src="https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?ixlib=rb-4.0.3&auto=format&fit=facearea&facepad=2&w=300&h=300&q=80"
            alt="Paciente"
          />
          <div className="hs-dropdown [--placement:top-left] relative inline-flex">
            <button
              id="hs-avatar-group-dropdown"
              className="hs-dropdown-toggle inline-flex items-center justify-center size-[46px] rounded-full bg-gray-100 border-2 border-white font-medium text-gray-700 shadow-sm align-middle hover:bg-gray-200 focus:outline-none focus:bg-gray-300 text-sm dark:bg-neutral-700 dark:text-white dark:hover:bg-neutral-600 dark:focus:bg-neutral-600 dark:border-neutral-800"
              aria-haspopup="menu"
              aria-expanded="false"
              aria-label="Dropdown"
            >
              <span className="font-medium leading-none">+</span>
            </button>

            <div
              className="hs-dropdown-menu hs-dropdown-open:opacity-100 w-48 hidden z-10 transition-[margin,opacity] opacity-0 duration-300 mb-2 bg-white shadow-md rounded-lg p-2 dark:bg-neutral-800 dark:border dark:border-neutral-700 dark:divide-neutral-700"
              role="menu"
              aria-orientation="vertical"
              aria-labelledby="hs-avatar-group-dropdown"
            >
              <a
                className="flex items-center gap-x-3.5 py-2 px-3 rounded-lg text-sm text-gray-800 hover:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
                href="#"
              >
                Ana Silva
              </a>
              <a
                className="flex items-center gap-x-3.5 py-2 px-3 rounded-lg text-sm text-gray-800 hover:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
                href="#"
              >
                João Santos
              </a>
              <a
                className="flex items-center gap-x-3.5 py-2 px-3 rounded-lg text-sm text-gray-800 hover:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
                href="#"
              >
                Maria Costa
              </a>
              <a
                className="flex items-center gap-x-3.5 py-2 px-3 rounded-lg text-sm text-gray-800 hover:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-300"
                href="#"
              >
                Carlos Oliveira
              </a>
            </div>
          </div>
        </div>

        <div className="text-center mt-6 space-y-2">
          <h2 className="text-2xl font-semibold text-gray-700">
            Central de Comunicação com Pacientes
          </h2>
          <p className="text-lg text-gray-500">
            Selecione uma conversa para iniciar o atendimento
          </p>
          <p className="text-sm text-gray-400 max-w-md mx-auto mt-4">
            Mantenha um atendimento humanizado e eficiente com seus pacientes através desta plataforma integrada
          </p>
        </div>
      </div>
    </div>
  )
}
