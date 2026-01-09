export type GridBlock = {
	id: string;
	img: string;
}

export function Grid(props: { blocks: (GridBlock | null)[], width: number, height: number, selected?: number, setSelected: (selected: number) => void }) {
	return <table className="grid">
		{Array(props.height).fill(0).map((_, ii) => <tr key={ii}>
			{Array(props.width).fill(0).map((_, jj) => {
				const block = props.blocks[ii * props.height + jj];
				let classes = "";
				if (!block) classes += " empty";
				if (ii * props.height + jj === props.selected) classes += " selected";
				return <td key={jj}>
					<div className={classes}>
						{block && <img src={block.img} />}
					</div>
				</td>
			})}
		</tr>)}
	</table>
}