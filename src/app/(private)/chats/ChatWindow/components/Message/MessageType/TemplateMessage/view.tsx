import React from "react"
import useTemplateMessageModel from "./model"

export default function TemplateMessageView({}: ReturnType<
  typeof useTemplateMessageModel
>) {
  return (
    <div>
      <div>TemplateMessageView</div>
    </div>
  )
}
