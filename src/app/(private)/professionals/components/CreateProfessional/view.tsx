import React from "react"
import useCreateProfessionalModel, {
  EnumAgeCategories,
  EnumFormStep,
} from "./model"
import {
  Card,
  CardHeader,
  Progress,
  Button,
  CardBody,
  Input,
  Switch,
  Alert,
  Checkbox,
  Chip,
  RadioGroup,
  Radio,
  Spinner,
  Avatar,
} from "@nextui-org/react"
import { formSteps, weekDays } from "./defaults"
import { TimeInput } from "@/components/ui/time-input"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Minus,
  Plus,
  Save,
  Search,
  User,
  Users,
  UserPlus,
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Service } from "@/contexts/Services/interfaces"
import { formatToBRL } from "@/app/(private)/utils/Currency"
import { Professional } from "@/contexts/Professionals/interfaces"

// Componente para selecionar um profissional existente ou criar um novo
const SelectProfessionalStep = ({ 
  existingProfessionals, 
  selectProfessional, 
  isCreatingNew, 
  setIsCreatingNew, 
  professionalSearchTerm, 
  setProfessionalSearchTerm,
  nextStep
}: { 
  existingProfessionals: Professional[], 
  selectProfessional: (professional: Professional) => void,
  isCreatingNew: boolean,
  setIsCreatingNew: React.Dispatch<React.SetStateAction<boolean>>,
  professionalSearchTerm: string,
  setProfessionalSearchTerm: React.Dispatch<React.SetStateAction<string>>,
  nextStep: () => void
}) => {
  const filteredProfessionals = professionalSearchTerm.trim() === "" 
    ? existingProfessionals 
    : existingProfessionals.filter(prof => 
        prof.nome.toLowerCase().includes(professionalSearchTerm.toLowerCase()) ||
        prof.email.toLowerCase().includes(professionalSearchTerm.toLowerCase()) ||
        prof.formacao.toLowerCase().includes(professionalSearchTerm.toLowerCase()) ||
        prof.especialidade?.toLowerCase().includes(professionalSearchTerm.toLowerCase())
      );

  return (
    <div className="space-y-6">
      <RadioGroup
        value={isCreatingNew ? "new" : "existing"}
        onValueChange={(value) => setIsCreatingNew(value === "new")}
      >
        <Radio value="new" description="Cadastre um novo profissional no sistema">
          <div className="flex items-center gap-2">
            <UserPlus size={18} />
            <span>Criar novo profissional</span>
          </div>
        </Radio>
        <Radio value="existing" description="Selecione um profissional já cadastrado">
          <div className="flex items-center gap-2">
            <Users size={18} />
            <span>Selecionar profissional existente</span>
          </div>
        </Radio>
      </RadioGroup>

      {!isCreatingNew && (
        <div className="space-y-4">
          <div className="relative">
            <Input
              placeholder="Buscar profissional por nome, email ou especialidade..."
              value={professionalSearchTerm}
              onChange={(e) => setProfessionalSearchTerm(e.target.value)}
              startContent={<Search size={18} />}
              isClearable
              onClear={() => setProfessionalSearchTerm("")}
              className="w-full"
            />
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filteredProfessionals.length === 0 ? (
              <Alert className="my-2">
                Nenhum profissional encontrado. Tente outra busca ou crie um novo profissional.
              </Alert>
            ) : (
              filteredProfessionals.map((professional) => (
                <div
                  key={professional.id}
                  className="p-4 bg-card text-card-foreground rounded-lg mt-4 hover:bg-muted cursor-pointer flex items-center justify-between"
                  onClick={() => selectProfessional(professional)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={professional.nome.charAt(0)}
                      color="primary"
                      size="sm"
                    />
                    <div>
                      <p className="font-medium">{professional.nome}</p>
                      <p className="text-sm text-muted-foreground">{professional.formacao} - {professional.especialidade}</p>
                    </div>
                  </div>
                  <Button size="sm" color="primary" variant="light">
                    Selecionar
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {isCreatingNew && (
        <div className="flex justify-end">
          <Button color="primary" onPress={nextStep}>
            Continuar
          </Button>
        </div>
      )}
    </div>
  );
};

export default function CreateProfessionalView({
  register,
  handleSubmit,
  onSubmit,
  watch,
  errors,
  setValue,
  current_step,
  currentStepIndex,
  currentProgress,
  nextStep,
  goBackStep,
  handleToggleageCategories,
  companyAgreements,
  handleToggleAgreements,
  handleToggleSpecialties,
  services,
  filteredServices,
  searchTerm,
  setSearchTerm,
  is_loading,
  setShowForm,
  specialties,
  existingProfessionals,
  selectProfessional,
  isCreatingNew,
  setIsCreatingNew,
  professionalSearchTerm,
  setProfessionalSearchTerm,
}: ReturnType<typeof useCreateProfessionalModel>) {
  return (
    <Card className="w-full shadow-md">
      <CardHeader className="flex flex-col gap-2">
        <div className="flex justify-between items-center w-full">
          <h2 className="text-xl font-semibold">Novo Profissional</h2>
          <div className="text-sm text-muted-foreground">
            Passo {currentStepIndex + 1} de {formSteps.length}
          </div>
        </div>
        <Progress
          aria-label="Progresso do cadastro"
          value={currentProgress}
          className="w-full"
          color="primary"
          showValueLabel={true}
        />

        <div className="flex flex-wrap gap-2 mt-4">
          {formSteps.map((step, index) => (
            <Button
              key={step.key}
              size="sm"
              variant={current_step === step.key ? "solid" : "light"}
              color={current_step === step.key ? "primary" : "default"}
              className="flex items-center gap-1"
              // onPress={() => goToStep(step.key)}
              // disabled={index > currentStepIndex && !canProceed()}
            >
              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-primary/10">
                {index < currentStepIndex ? (
                  <Check size={12} className="text-primary" />
                ) : (
                  <span className="text-xs">{index + 1}</span>
                )}
              </span>
              <span className="hidden md:inline">{step.title}</span>
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardBody>
        <div className="mb-4">
          <h3 className="text-lg font-medium">
            {formSteps[currentStepIndex].title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {formSteps[currentStepIndex].description}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {current_step === EnumFormStep.SELECT && (
            <SelectProfessionalStep
              existingProfessionals={existingProfessionals}
              selectProfessional={selectProfessional}
              isCreatingNew={isCreatingNew}
              setIsCreatingNew={setIsCreatingNew}
              professionalSearchTerm={professionalSearchTerm}
              setProfessionalSearchTerm={setProfessionalSearchTerm}
              nextStep={nextStep}
            />
          )}
          {current_step === EnumFormStep.INFO && (
            <div className="grid grid-rows-3 gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Nome do Profissional*"
                  type="text"
                  {...register("nome", { required: true })}
                  errorMessage={errors?.nome?.message}
                  isInvalid={!!errors?.nome?.message}
                />

                <Input
                  label="Formação*"
                  type="text"
                  {...register("formacao", { required: true })}
                  errorMessage={errors?.formacao?.message}
                  isInvalid={!!errors?.formacao?.message}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Número de Registro*"
                  type="text"
                  {...register("registro", { required: true })}
                  errorMessage={errors?.registro?.message}
                  isInvalid={!!errors?.registro?.message}
                />

                <Input
                  label="E-mail*"
                  type="text"
                  {...register("email", { required: true })}
                  errorMessage={errors?.email?.message}
                  isInvalid={!!errors?.email?.message}
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                <Input
                  label="Telefone*"
                  type="text"
                  {...register("telefone", { required: true })}
                  errorMessage={errors?.telefone?.message}
                  isInvalid={!!errors?.telefone?.message}
                />
              </div>
            </div>
          )}

          {current_step === EnumFormStep.AGE_CATEGORIES && (
            <div className="space-y-6">
              {errors?.quem_atende?.message && (
                <Alert color="danger" title={errors?.quem_atende?.message} />
              )}

              <div className="flex flex-col gap-6 max-w-md mx-auto">
                <div className="flex justify-between items-center p-4 bg-primary/5 rounded-xl">
                  <div>
                    <h4 className="text-lg font-medium">Adulto</h4>
                    <p className="text-sm text-muted-foreground">
                      Atende pacientes adultos
                    </p>
                  </div>
                  <div>
                    <Switch
                      isSelected={
                        watch("quem_atende")?.includes(
                          EnumAgeCategories.ADULT
                        ) || false
                      }
                      onValueChange={(isSelected) =>
                        handleToggleageCategories(
                          EnumAgeCategories.ADULT,
                          isSelected
                        )
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center p-4 bg-primary/5 rounded-xl">
                  <div>
                    <h4 className="text-lg font-medium">Criança</h4>
                    <p className="text-sm text-muted-foreground">
                      Atende pacientes infantis
                    </p>
                  </div>
                  <div>
                    <Switch
                      isSelected={
                        watch("quem_atende")?.includes(
                          EnumAgeCategories.CHILD
                        ) || false
                      }
                      onValueChange={(isSelected) =>
                        handleToggleageCategories(
                          EnumAgeCategories.CHILD,
                          isSelected
                        )
                      }
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center p-4 bg-primary/5 rounded-xl">
                  <div>
                    <h4 className="text-lg font-medium">Adolescente</h4>
                    <p className="text-sm text-muted-foreground">
                      Atende pacientes adolescentes
                    </p>
                  </div>
                  <div>
                    <Switch
                      isSelected={
                        watch("quem_atende")?.includes(
                          EnumAgeCategories.TEEN
                        ) || false
                      }
                      onValueChange={(isSelected) =>
                        handleToggleageCategories(
                          EnumAgeCategories.TEEN,
                          isSelected
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {current_step === EnumFormStep.AGREEMENTS && (
            <div className="space-y-6">
              {companyAgreements.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {companyAgreements.map((agreement) => (
                    <div
                      key={agreement.id}
                      className="flex justify-between items-center p-4 bg-primary/5 rounded-xl"
                    >
                      <div>
                        <h4 className="font-medium">{agreement.name}</h4>
                      </div>
                      <div>
                        <Switch
                          isSelected={
                            watch("agreements")?.includes(agreement.id) || false
                          }
                          onValueChange={(isSelected) =>
                            handleToggleAgreements(isSelected, agreement.id)
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8">
                  <p className="text-muted-foreground">
                    Nenhum convênio cadastrado. Cadastre convênios na área de
                    configurações da empresa.
                  </p>
                </div>
              )}
            </div>
          )}

          {current_step === EnumFormStep.SPECIALTIES && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {specialties?.map((specialty) => (
                  <div
                    key={specialty.id}
                    className="flex items-center p-3 border rounded-lg hover:bg-muted transition-colors"
                  >
                    <Checkbox
                      isSelected={watch("specialties")?.includes(specialty.id)}
                      onValueChange={(isSelected) =>
                        handleToggleSpecialties(isSelected, specialty.id)
                      }
                    />
                    <div className="ml-2">
                      <div className="font-medium">{specialty.name}</div>
                      {specialty.description && (
                        <div className="text-xs text-muted-foreground">
                          {specialty.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {watch("specialties") && (
                <div className="mt-4">
                  <label className="text-sm font-medium mb-2 block">
                    Especialidades Selecionadas:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {watch("specialties")?.map((id: string) => {
                      const specialty = specialties.find((s) => s.id === id)
                      return specialty ? (
                        <Chip
                          key={id}
                          variant="flat"
                          color="primary"
                          onClose={() => handleToggleSpecialties(false, id)}
                        >
                          {specialty.name}
                        </Chip>
                      ) : null
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {current_step === EnumFormStep.SERVICES && (
            <div className="space-y-6">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                  size={18}
                />
                <Input
                  type="text"
                  placeholder="Buscar serviços..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {services.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredServices.map((service: Service) => (
                    <div
                      key={service.id}
                      className="border rounded-xl p-4 space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium text-base">
                            {service.name}
                          </h4>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {service.description || "Sem descrição"}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Chip size="sm" color="primary" variant="flat">
                              <div className="flex gap-1">
                                <div>
                                  <Clock size={15} />
                                </div>
                                <div>{service.tempo_medio || 30} min</div>
                              </div>
                            </Chip>
                            <Chip size="sm" color="success" variant="flat">
                              {formatToBRL(service.price)}
                            </Chip>
                          </div>
                        </div>
                        <div>
                          <Switch
                            checked={
                              watch("services")?.some(
                                (s) => s.service_id === service.id
                              ) || false
                            }
                            onValueChange={(isSelected) => {
                              const services = [...(watch("services") || [])]

                              setValue(
                                "services",
                                isSelected
                                  ? [
                                      ...services,
                                      {
                                        service_id: service.id,
                                        tipo: "INDIVIDUAL",
                                        amount: 2,
                                      },
                                    ]
                                  : services.filter(
                                      (s) => s.service_id !== service.id
                                    )
                              )
                            }}
                          />
                        </div>
                      </div>

                      {watch("services")?.length > 0 &&
                        watch("services")?.filter(
                          (s) => s.service_id === service.id
                        ).length > 0 && (
                          <div className="pt-2 border-t mt-2">
                            <RadioGroup
                              orientation="horizontal"
                              value={
                                watch("services")
                                  ?.find((s) => s.service_id === service.id)
                                  ?.tipo.toLowerCase() || ""
                              }
                              onValueChange={(newTipo) => {
                                const services = watch("services") || []

                                setValue(
                                  "services",
                                  services.map((s) =>
                                    s.service_id === service.id
                                      ? {
                                          ...s,
                                          tipo: newTipo.toUpperCase() as
                                            | "INDIVIDUAL"
                                            | "GRUPO"
                                            | "AMBOS",
                                        }
                                      : s
                                  )
                                )
                              }}
                              className="flex justify-start gap-4"
                              // @ts-expect-error value
                              value={
                                watch("services")?.find(
                                  (s) => s.service_id === service.id
                                )?.tipo || ""
                              }
                            >
                              <Radio value="INDIVIDUAL">
                                <div className="flex items-center gap-1">
                                  <User size={14} />
                                  <span className="text-sm">Individual</span>
                                </div>
                              </Radio>
                              <Radio value="GRUPO">
                                <div className="flex items-center gap-1">
                                  <Users size={14} />
                                  <span className="text-sm">Grupo</span>
                                </div>
                              </Radio>
                              <Radio value="AMBOS">
                                <div className="flex items-center gap-1">
                                  <span className="text-sm">Ambos</span>
                                </div>
                              </Radio>
                            </RadioGroup>
                          </div>
                        )}

                      {watch("services")?.some(
                        (s) => s.service_id === service.id
                      ) &&
                        watch("services")?.find(
                          (s) => s.service_id === service.id
                        )?.tipo !== "INDIVIDUAL" && (
                          <div className="pt-2">
                            <label
                              htmlFor={`max_pessoas_${service.id}`}
                              className="text-sm font-medium"
                            >
                              Limite de pessoas por grupo
                            </label>
                            <div className="flex items-center gap-2 mt-1">
                              <>
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="flat"
                                  onPress={() => {
                                    const services = watch("services") || []

                                    setValue(
                                      "services",
                                      services.map((s) =>
                                        s.service_id === service.id
                                          ? {
                                              ...s,
                                              amount: Math.max(
                                                2,
                                                (watch("services")?.find(
                                                  (s) =>
                                                    s.service_id === service.id
                                                )?.amount || 2) - 1
                                              ),
                                            }
                                          : s
                                      )
                                    )
                                  }}
                                >
                                  <Minus size={14} />
                                </Button>
                                <Input
                                  type="number"
                                  min={2}
                                  className="w-16 text-center"
                                  readOnly
                                  value={
                                    watch("services")
                                      ?.find((s) => s.service_id === service.id)
                                      ?.amount?.toString() || "2"
                                  }
                                />
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="flat"
                                  onPress={() => {
                                    const services = watch("services") || []

                                    setValue(
                                      "services",
                                      services.map((s) =>
                                        s.service_id === service.id
                                          ? {
                                              ...s,
                                              amount: Math.max(
                                                2,
                                                (watch("services")?.find(
                                                  (s) =>
                                                    s.service_id === service.id
                                                )?.amount || 2) + 1
                                              ),
                                            }
                                          : s
                                      )
                                    )
                                  }}
                                >
                                  <Plus size={14} />
                                </Button>
                              </>
                              <span className="text-sm text-muted-foreground">
                                pessoas
                              </span>
                            </div>
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center p-8">
                  <p className="text-muted-foreground">
                    Nenhum serviço cadastrado. Cadastre serviços na área
                    correspondente antes de continuar.
                  </p>
                </div>
              )}
            </div>
          )}

          {current_step === EnumFormStep.SCHEDULE && (
            <div className="space-y-6">
              <Tabs defaultValue={"monday"}>
                <TabsList className="w-full flex overflow-auto">
                  {weekDays.map((day) => (
                    <TabsTrigger key={day.id} value={day.id} className="flex-1">
                      {day.name}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {weekDays.map((day) => (
                  <TabsContent
                    key={day.id}
                    value={day.id}
                    className="p-4 bg-card text-card-foreground rounded-lg mt-4"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-foreground">{day.name}</h4>

                        <div className="flex items-center space-x-2">
                          <Switch
                            isSelected={watch(`scheduler.${day.id}.enabled`)}
                            onValueChange={(isEnabled) => {
                              setValue(`scheduler.${day.id}.enabled`, isEnabled)
                              if (!isEnabled) {
                                setValue(`scheduler.${day.id}.opening`, "")
                                setValue(`scheduler.${day.id}.closing`, "")
                              }
                            }}
                          />
                          <div className="text-foreground">
                            {watch(`scheduler.${day.id}.enabled`)
                              ? "Ativo"
                              : "Inativo"}
                          </div>
                        </div>
                      </div>

                      {watch(`scheduler.${day.id}.enabled`) && (
                        <div className="grid grid-cols-2 gap-4">
                          <TimeInput
                            label="Abertura"
                            disabled={!watch(`scheduler.${day.id}.enabled`)}
                            onChange={(value) => {
                              setValue(`scheduler.${day.id}.opening`, value)
                            }}
                            value={watch(`scheduler.${day.id}.opening`) || ""}
                          />
                          <TimeInput
                            label="Fechamento"
                            disabled={!watch(`scheduler.${day.id}.enabled`)}
                            onChange={(value) => {
                              setValue(`scheduler.${day.id}.closing`, value)
                            }}
                            value={watch(`scheduler.${day.id}.closing`) || ""}
                          />
                        </div>
                      )}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}

          {current_step === EnumFormStep.OBSERVATIONS && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Observações sobre o atendimento
                </label>
                <textarea
                  className="w-full min-h-[150px] p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Informações adicionais sobre o atendimento deste profissional..."
                  {...register("observacoes")}
                />
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8">
            <Button
              color="default"
              onPress={() => setShowForm(false)}
              type="button"
            >
              Cancelar
            </Button>

            <div className="flex gap-2">
              {currentStepIndex > 0 && (
                <Button
                  color="default"
                  variant="flat"
                  onPress={() => goBackStep()}
                  type="button"
                  startContent={<ChevronLeft size={16} />}
                >
                  Anterior
                </Button>
              )}

              {current_step !== EnumFormStep.OBSERVATIONS && (
                <Button
                  color="primary"
                  type="button"
                  endContent={<ChevronRight size={16} />}
                  onPress={() => nextStep()}
                >
                  Próximo
                </Button>
              )}

              {current_step === EnumFormStep.OBSERVATIONS && (
                <Button
                  color="primary"
                  type="submit"
                  disabled={is_loading}
                  startContent={
                    is_loading ? (
                      <Spinner size="sm" color="white" />
                    ) : (
                      <Save size={16} />
                    )
                  }
                >
                  {is_loading ? "Salvando..." : "Salvar Profissional"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
