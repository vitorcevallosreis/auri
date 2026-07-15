"use client"

import { useState, useEffect } from "react"

export interface IstatisticModel {
  value1: number
  value2: number
  value3: number
}

const usestatisticModel = (): IstatisticModel => {
  const [value1, setValue1] = useState(0)
  const [value2, setValue2] = useState(0)
  const [value3, setValue3] = useState(0)

  useEffect(() => {
    setValue1(80)
    setValue2(95)
    setValue3(30)

    return () => {
      setValue1(0)
      setValue2(0)
      setValue3(0)
    }
  }, [])

  return { value1, value2, value3 }
}

export default usestatisticModel
