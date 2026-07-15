import useCreateProfessionalModel from "./model"
import CreateProfessionalView from "./view"

interface ICreateProfessionalProps {
  setShowForm: React.Dispatch<React.SetStateAction<boolean>>
}

export default function CreateProfessional({
  setShowForm,
}: ICreateProfessionalProps) {
  const CreateProfessionalModel = useCreateProfessionalModel(setShowForm)

  return <CreateProfessionalView {...CreateProfessionalModel} />
}
