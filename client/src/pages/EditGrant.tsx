import { useParams } from "react-router-dom";
import GrantForm from "../components/GrantForm/GrantForm";

export default function EditGrant() {
  const { grantId } = useParams();
  return <GrantForm mode="edit" grantId={grantId} />;
}
