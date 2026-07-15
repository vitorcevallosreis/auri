import React, { useState } from "react"
import useUpdateServiceModel from "./model"
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Switch,
  Textarea,
  Card,
  CardBody,
  Divider,
} from "@nextui-org/react"
import { ConvenioValor } from "@/contexts/Services/interfaces"

export default function UpdateServiceView({
  is_open,
  set_is_open,
  onSubmit,
  handleSubmit,
  register,
  errors,
  watch,
  setValue,
}: ReturnType<typeof useUpdateServiceModel>) {
  return (
    <>
      <Button onPress={() => set_is_open(true)}>Ver/Editar</Button>
      <Modal
        isOpen={is_open}
        onOpenChange={() => set_is_open(false)}
        placement="center"
        size="3xl"
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  Atualizar Serviço
                </ModalHeader>
                <ModalBody>
                  <Input
                    label="Nome do Serviço"
                    type="text"
                    {...register("name")}
                    errorMessage={errors?.name?.message}
                    isInvalid={errors.name ? true : false}
                  />

                  <Input
                    label="Preço do Serviço"
                    type="number"
                    {...register("price")}
                    errorMessage={errors?.price?.message}
                    isInvalid={errors.price ? true : false}
                  />

                  <Input
                    label="Tempo Médio (minutos)"
                    type="text"
                    {...register("tempo_medio")}
                    errorMessage={errors?.tempo_medio?.message}
                    isInvalid={errors.tempo_medio ? true : false}
                  />

                  <Textarea
                    label="Descrição do Serviço"
                    type="text"
                    {...register("description")}
                    errorMessage={errors?.description?.message}
                    isInvalid={errors.description ? true : false}
                    maxRows={4}
                    rows={4}
                  />

                  <div className="flex flex-col gap-2">
                    <Switch
                      onValueChange={(value) => setValue("available", value)}
                      isSelected={watch("available")}
                      aria-label="Disponibilidade do Serviço"
                    >
                      Serviço {watch("available") ? "Disponível" : "Indisponível"}
                    </Switch>

                    <Switch
                      onValueChange={(value) => {
                        setValue("aceita_convenio", value);
                        if (!value) {
                          setValue("valores_convenios", null);
                        }
                      }}
                      isSelected={watch("aceita_convenio")}
                      aria-label="Aceita Convênio"
                    >
                      {watch("aceita_convenio") ? "Aceita Convênio" : "Não Aceita Convênio"}
                    </Switch>
                  </div>

                  {watch("aceita_convenio") && (
                    <ConveniosSection
                      convenios={watch("valores_convenios") || []}
                      onChange={(convenios) => setValue("valores_convenios", convenios)}
                    />
                  )}
                </ModalBody>
                <ModalFooter>
                  <Button color="danger" variant="light" onPress={onClose}>
                    Fechar
                  </Button>
                  <Button color="primary" type="submit">
                    Salvar
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </form>
      </Modal>
    </>
  )
}

// Componente para gerenciar a seção de convênios
function ConveniosSection({
  convenios,
  onChange,
}: {
  convenios: ConvenioValor[];
  onChange: (convenios: ConvenioValor[]) => void;
}) {
  const [novoConvenio, setNovoConvenio] = useState<string>("");
  const [valorConvenio, setValorConvenio] = useState<number>(0);

  const adicionarConvenio = () => {
    if (!novoConvenio || valorConvenio <= 0) return;
    
    const novosConvenios = [
      ...convenios,
      {
        convenio: novoConvenio,
        valor: valorConvenio,
        enable: true
      }
    ];
    
    onChange(novosConvenios);
    setNovoConvenio("");
    setValorConvenio(0);
  };

  const removerConvenio = (index: number) => {
    const novosConvenios = [...convenios];
    novosConvenios.splice(index, 1);
    onChange(novosConvenios);
  };

  const toggleConvenio = (index: number) => {
    const novosConvenios = [...convenios];
    novosConvenios[index].enable = !novosConvenios[index].enable;
    onChange(novosConvenios);
  };

  return (
    <Card>
      <CardBody>
        <h3 className="text-lg font-semibold mb-2">Valores por Convênio</h3>
        
        <div className="flex gap-2 mb-4">
          <Input
            label="Nome do Convênio"
            value={novoConvenio}
            onChange={(e) => setNovoConvenio(e.target.value)}
            placeholder="Ex: Unimed"
            className="flex-1"
          />
          <Input
            label="Valor (R$)"
            type="number"
            value={valorConvenio.toString()}
            onChange={(e) => setValorConvenio(Number(e.target.value))}
            placeholder="100.00"
            className="w-32"
          />
          <Button
            color="primary"
            isIconOnly
            className="mt-auto"
            onClick={adicionarConvenio}
          >
            +
          </Button>
        </div>

        <Divider className="my-2" />

        {convenios.length === 0 ? (
          <p className="text-gray-500 text-sm">Nenhum convênio adicionado</p>
        ) : (
          <div className="space-y-2">
            {convenios.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    isSelected={item.enable}
                    onValueChange={() => toggleConvenio(index)}
                    size="sm"
                  />
                  <span className={item.enable ? "" : "text-gray-400"}>
                    {item.convenio}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={item.enable ? "" : "text-gray-400"}>
                    R$ {item.valor.toFixed(2)}
                  </span>
                  <Button
                    color="danger"
                    isIconOnly
                    size="sm"
                    variant="light"
                    onClick={() => removerConvenio(index)}
                  >
                    -
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
