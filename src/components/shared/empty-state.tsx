import Image from "next/image";

interface Props {
  title: string;
  description: string;
  /** Omitted ⇒ no illustration. Never defaulted to an asset that may not exist. */
  image?: string;
}

const EmptyState = ({ title, description, image }: Props) => {
  return (
    <div className="flex flex-col items-center justify-center">
      {image && (
        <Image src={image} width={240} height={240} alt="" aria-hidden="true" />
      )}
      <div className="mx-auto flex max-w-md flex-col gap-y-6 text-center">
        <h6 className="text-lg font-medium">{title}</h6>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  );
};

export default EmptyState;
